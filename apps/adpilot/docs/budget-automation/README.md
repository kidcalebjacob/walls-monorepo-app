# AdPilot - Budget Automation Algorithm

> **Status: Scoping / Draft.** This document describes how the AdPilot budget
> automation engine _will_ work. Rules marked **(TBD)** are still being figured
> out. Nothing here is final - it is the shared source of truth while we design
> the worker that actually talks to the Meta Marketing API.

---

## 1. What this is

AdPilot lets an operator hand a campaign or ad set over to an automated worker
that raises or lowers the **daily budget** on a schedule, inside guardrails the
operator sets. The goal is simple:

- **Scale spend on winners** (up to a ceiling)
- **Pull back on losers** (down to a floor)
- **Kill anything that is losing money** so we stop bleeding budget

The engine is a mix of **hard, deterministic rules** (safety, floors, ceilings,
caps) and a **GPT agent** that reasons about _why_ an ad is performing the way it
is and recommends a move within the hard bounds. The hard rules always win; the
GPT agent can only act inside them.

---

## 2. Where the settings live

Every decision is bounded by settings that already exist in the app.

### Workspace preset - `ad_automation_profiles`

Reusable templates an operator configures in **Settings**. Each profile has an
`optimization_goal` (`roas` | `ctr` | `cpa` | `conversions`) and a `settings`
JSON blob (`SpendAutomationSettings`).

### Per-entity enrollment - `ad_entity_automation`

When AdPilot is enabled on a campaign or ad set, a row here stores:

| Column | Meaning |
| --- | --- |
| `enabled` | Master on/off for this entity |
| `profile_id` | Which preset it inherits from |
| `settings_override` | Per-entity tweaks that beat the preset |
| `cooldown_hours` | Min hours between budget changes (NULL → inherit preset) |
| `min_daily_budget_micros` | Hard floor the worker may not go below |
| `max_daily_budget_micros` | Hard ceiling (the "high-end stopper" - see §4) |
| `automation_status` | `inactive` / `active` / `paused` / `cooldown` / `learning` / `error` |
| `last_adjusted_at` | Drives the cooldown check |

### Agent instructions - `ad_agent_instructions`

Operator-authored natural-language guidance for the GPT agent. An entity can have
**multiple** instructions, each with its own schedule window, so you can queue up
future changes (e.g. "scale hard until month-end", then a different rule after).

| Column | Meaning |
| --- | --- |
| `entity_id` | Campaign / ad set the instruction applies to |
| `instructions` | The prompt text the agent reads |
| `starts_at` | When it becomes active (NULL → immediately; future = scheduled) |
| `ends_at` | When it stops applying (NULL → no expiry) |
| `is_active` | Manual on/off switch, independent of the schedule window |

An instruction is **in effect** when `is_active = true` **and** now is within
`[starts_at, ends_at)`. The worker should concatenate all in-effect instructions
for an entity into the agent prompt. Hard guardrails (§3–§4) always win over
anything an instruction asks for. The `resolveInstructionStatus()` helper in
`lib/agent-instructions-server.ts` returns the same `active` / `scheduled` /
`expired` / `disabled` states the UI shows.

### Effective settings (`SpendAutomationSettings`)

Resolved as **preset settings + entity overrides**:

| Field | Role in the algorithm |
| --- | --- |
| `aggressiveness` (0–100) | How hard we ramp winners |
| `maxDailyIncreasePct` | Cap on % **increase** in one 24h window |
| `maxDailyDecreasePct` | Cap on % **decrease** in one 24h window |
| `scaleUpCapPct` | Cap on a single optimization jump |
| `roasFloor` | Minimum acceptable ROAS (the "low-end stopper") |
| `ctrFloorPct` | Minimum CTR (CTR-goal campaigns) |
| `cpaCeiling` | Max cost per acquisition (CPA/conversion goals) |
| `cooldownHours` | Wait time between moves |
| `learningPhaseProtection` | Do not touch while Meta says "learning" |
| `pauseOnFatigue` | Slow down when frequency rises / CTR falls |

### Audit log - `ad_budget_adjustments`

Every decision (including "no change" and "deactivated") should be written here
with the previous/new budget, `change_pct`, `decision_reason`, and whether the
provider (Meta) actually applied it.

---

## 3. The low-end stopper (ROAS floor → deactivate)

**Rule (agreed):** For a **ROAS-outcome** campaign:

```
IF optimization_goal == "roas"
AND current_roas < roasFloor
AND entity is NOT in its learning phase
THEN deactivate the campaign
```

Rationale: below the floor the campaign is no longer profitable. Rather than
just trimming budget, it should **stop**. It is not making us money.

Details to lock down:

- **Deactivate = ?** Pause the campaign on Meta and set
  `automation_status = 'paused'` (or a new `stopped`). We should **not** silently
  delete anything. **(TBD: pause vs. drop to `min_daily_budget`)**
- **Learning phase exception:** while Meta reports the entity as learning
  (and `learningPhaseProtection` is on), we do **not** deactivate - the ROAS is
  not trustworthy yet.
- **Measurement window:** "current ROAS" needs a defined window (today only? a
  rolling 3-day? see §6 on candles). **(TBD)**

---

## 4. The high-end stopper (ceiling)

When an ad is winning, how high can spend go? Two modes:

1. **Uncapped / infinite** - keep scaling as long as performance holds, only
   throttled by `maxDailyIncreasePct` per window.
2. **Capped at max daily budget** - never exceed `max_daily_budget_micros` on the
   ad or campaign.

The operator picks the mode per entity. Even in "infinite" mode, the
per-window `maxDailyIncreasePct` and `scaleUpCapPct` still apply - infinite means
"no absolute ceiling," not "unlimited jump in one day."

**(TBD: is the default mode capped or infinite? Probably capped for safety.)**

---

## 5. Increase / decrease logic

This is the part we are still scoping. Structure it as **hard rules that bound
the move**, with a **GPT agent choosing the exact number inside those bounds**.

### 5.1 Hard rules (deterministic guardrails)

These are non-negotiable and run before/after the agent:

- **Cooldown:** if `now - last_adjusted_at < cooldownHours`, do nothing.
  Status → `cooldown`.
- **Learning protection:** if learning and `learningPhaseProtection`, no
  scale-ups.
- **Bounds clamp:** any proposed budget is clamped to
  `[min_daily_budget, max_daily_budget]` (or `[min, ∞)` if uncapped).
- **Per-window caps:** increase ≤ `maxDailyIncreasePct`, decrease ≤
  `maxDailyDecreasePct`, single jump ≤ `scaleUpCapPct`.
- **Floor breach:** ROAS < `roasFloor` (and not learning) → §3 deactivate,
  skip any increase.
- **Fatigue:** if `pauseOnFatigue` and frequency rising while CTR falls → block
  increases, bias toward a decrease.

### 5.2 Scale-up ("the ad is killing it")

If performance is strong and no guardrail blocks it, increase toward
`maxDailyIncreasePct`. `aggressiveness` scales how much of that headroom we use:

```
proposed_increase_pct = f(aggressiveness) * maxDailyIncreasePct
```

**(TBD: exact shape of `f`. Simplest: linear, aggressiveness/100.)**

### 5.3 Scale-down ("the ROAS is dying")

This is the open question: **how much do we drop, and when?**

Working idea - size the cut to how hard performance fell, bounded by
`maxDailyDecreasePct`:

- Compare a performance signal (ROAS) today vs. its recent baseline.
- The bigger the relative drop, the bigger the cut (proportional response).
- Never cut more than `maxDailyDecreasePct` in one window.
- If it drops below `roasFloor` entirely → §3 (stop), not just a cut.

```
drop_ratio      = max(0, (baseline_roas - current_roas) / baseline_roas)
proposed_cut_pct = min(maxDailyDecreasePct, drop_ratio * maxDailyDecreasePct * k)
```

**Open questions (need answers):**

- What is `baseline_roas`? Yesterday, a 3-day avg, a 7-day avg? (see §6)
- What is `k` (sensitivity)? Should it be tied to `aggressiveness`?
- Is there a "dead zone" (e.g. < 10% drop = no change) to avoid twitchy edits?
- Do we ever cut _and_ keep it running, or is a big enough drop just a stop?

---

## 6. "Candles" - trend over time

Rather than reacting to a single day, evaluate a rolling series of daily buckets
("candles"), like price candles, to read the **trend**:

- **Growing over the past week** → lean toward increasing.
- **Falling quickly** → lean toward decreasing (or stopping).
- **Flat / noisy** → hold, avoid churn.

Things to define:

- **Window & granularity:** daily candles over a 7-day trailing window? **(TBD)**
- **Signal per candle:** ROAS, spend, conversions, CTR, frequency.
- **Trend detection:** slope / moving average / week-over-week delta. **(TBD)**
- **Smoothing:** ignore single-day spikes so we do not overreact.

The candle series is also the primary context we hand the GPT agent.

---

## 7. The GPT agent

Hard rules decide **whether** we can move and the **allowed range**. The GPT
agent decides the **exact move within that range** and, importantly, explains
**why** the ad is doing well or badly.

- **Inputs:** entity metadata, effective settings, the candle series (§6),
  learning status, fatigue signals, recent adjustment history.
- **Output (structured):** a proposed `new_daily_budget` (or "stop"), a
  confidence, and a human-readable `decision_reason`.
- **Constraint:** the app **re-clamps** the agent's number to the hard bounds in
  §5.1 before applying. The agent can never exceed a guardrail.
- **Value add:** qualitative reasoning ("CTR climbing while frequency stays low →
  fresh audience, safe to push") that pure rules miss.

**(TBD:** model choice, prompt format, JSON schema, and how much authority the
agent gets vs. the deterministic path.**)**

---

## 8. Decision loop (per entity, per run)

```
1. Skip if !enabled or within cooldownHours.
2. Pull metrics → build candle series (§6).
3. If learning && learningPhaseProtection → status = learning, exit.
4. Evaluate floor:
     ROAS < roasFloor && !learning → deactivate (§3), log, exit.
5. Build allowed move range from hard rules (§5.1).
6. Ask GPT agent for a move + reason within that range (§7).
7. Clamp to [min, max] / per-window caps.
8. Apply to Meta; write ad_budget_adjustments; set last_adjusted_at + status.
```

---

## 9. Open questions (tracking)

- [ ] Deactivate = pause on Meta, or drop to min budget?
- [ ] ROAS measurement window (today vs. rolling average)?
- [ ] Scale-down math: baseline, sensitivity `k`, dead zone?
- [ ] Default ceiling mode: capped vs. infinite?
- [ ] Candle window/granularity and trend metric?
- [ ] Exact split of authority between hard rules and the GPT agent?
- [ ] How do CTR-floor and CPA-ceiling goals mirror the ROAS logic?
- [ ] Run cadence of the worker (hourly? daily? cron vs. queue)?

---

## 10. Not built yet

The backend worker (metric aggregation, candle builder, GPT call, Meta budget
writes, cron scheduling) does **not** exist yet. Today the app only stores
enrollment and settings; this document is the spec for building that worker.
