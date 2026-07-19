export type SuiteCapability = {
  id: string;
  title: string;
  description: string;
  href: string;
  orb: {
    from: string;
    mid: string;
    to: string;
    glow: string;
  };
};

export type SuiteFeature = {
  id: string;
  name: string;
  capabilities: SuiteCapability[];
};

export type KenooSuite = {
  id: string;
  name: string;
  description: string;
  dot: string;
  features: SuiteFeature[];
};

/** Top-of-home showcase — one entry per real product app. */
export const KENOO_SUITES: KenooSuite[] = [
  {
    id: "crm",
    name: "CRM",
    description:
      "People, companies, deals, pitches, and sequences so your team always knows who needs attention next.",
    dot: "#0b6eff",
    features: [
      {
        id: "people",
        name: "People",
        capabilities: [
          {
            id: "contacts",
            title: "Contacts",
            description:
              "A clear record of every relationship—roles, history, and next steps.",
            href: "/product#crm",
            orb: {
              from: "#0b6eff",
              mid: "#5a9fff",
              to: "#083d8f",
              glow: "rgba(11,110,255,0.65)",
            },
          },
          {
            id: "enrichment",
            title: "Enrichment",
            description:
              "Lead search and context that fill in the blanks before the first outreach.",
            href: "/product#crm",
            orb: {
              from: "#30a1f4",
              mid: "#6ec4ff",
              to: "#0066b2",
              glow: "rgba(48,161,244,0.65)",
            },
          },
          {
            id: "ownership",
            title: "Ownership",
            description:
              "Know who owns each contact so follow-ups never fall through the cracks.",
            href: "/product#crm",
            orb: {
              from: "#4d8ef0",
              mid: "#8eb8ff",
              to: "#1e4a9e",
              glow: "rgba(77,142,240,0.65)",
            },
          },
        ],
      },
      {
        id: "companies",
        name: "Companies",
        capabilities: [
          {
            id: "accounts",
            title: "Accounts",
            description:
              "Companies tied to people, deals, and projects—not a disconnected list.",
            href: "/product#crm",
            orb: {
              from: "#0066b2",
              mid: "#30a1f4",
              to: "#0a3a66",
              glow: "rgba(0,102,178,0.65)",
            },
          },
          {
            id: "context",
            title: "Context",
            description:
              "Notes and activity that make every account conversation feel informed.",
            href: "/product#crm",
            orb: {
              from: "#1a6dff",
              mid: "#4d9fff",
              to: "#0a3d8c",
              glow: "rgba(11,110,255,0.7)",
            },
          },
          {
            id: "vendors",
            title: "Vendors",
            description:
              "Keep partner and vendor details alongside the rest of your pipeline.",
            href: "/product#crm",
            orb: {
              from: "#6eadc0",
              mid: "#9fd0dc",
              to: "#3d7a8a",
              glow: "rgba(110,173,192,0.65)",
            },
          },
        ],
      },
      {
        id: "deals",
        name: "Deals",
        capabilities: [
          {
            id: "pipeline",
            title: "Pipeline",
            description:
              "Stages that stay readable so wins and blockers are never buried.",
            href: "/product#crm",
            orb: {
              from: "#0b6eff",
              mid: "#3d8cff",
              to: "#052a66",
              glow: "rgba(11,110,255,0.7)",
            },
          },
          {
            id: "priorities",
            title: "Priorities",
            description:
              "Surface the next conversation instead of scrolling endless lists.",
            href: "/product#crm",
            orb: {
              from: "#1a7ae0",
              mid: "#6eb4ff",
              to: "#0a3d70",
              glow: "rgba(26,122,224,0.65)",
            },
          },
          {
            id: "history",
            title: "History",
            description:
              "A durable trail of touches so nothing depends on memory alone.",
            href: "/product#crm",
            orb: {
              from: "#0066b2",
              mid: "#4da3e0",
              to: "#083554",
              glow: "rgba(0,102,178,0.65)",
            },
          },
        ],
      },
      {
        id: "outreach",
        name: "Outreach",
        capabilities: [
          {
            id: "sequences",
            title: "Sequences",
            description:
              "Structured follow-ups that stay human, not spammy automation.",
            href: "/product#crm",
            orb: {
              from: "#30a1f4",
              mid: "#7cc8ff",
              to: "#0b6eff",
              glow: "rgba(48,161,244,0.65)",
            },
          },
          {
            id: "pitches",
            title: "Pitches",
            description:
              "Keep proposals and talking points tied to the right account.",
            href: "/product#crm",
            orb: {
              from: "#6eadc0",
              mid: "#a8d8e4",
              to: "#2f6b7a",
              glow: "rgba(110,173,192,0.65)",
            },
          },
          {
            id: "follow-ups",
            title: "Follow-ups",
            description:
              "Never lose a warm lead because it slipped out of view.",
            href: "/product#crm",
            orb: {
              from: "#0b6eff",
              mid: "#5a9fff",
              to: "#083d8f",
              glow: "rgba(11,110,255,0.65)",
            },
          },
        ],
      },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    description:
      "Task boards, timelines, and project overviews so delivery stays visible from backlog to done.",
    dot: "#f08a5d",
    features: [
      {
        id: "tasks",
        name: "Tasks",
        capabilities: [
          {
            id: "boards",
            title: "Boards",
            description:
              "Work that stays clear from backlog to done without noisy boards.",
            href: "/product#projects",
            orb: {
              from: "#f08a5d",
              mid: "#ffb08a",
              to: "#a84a28",
              glow: "rgba(240,138,93,0.7)",
            },
          },
          {
            id: "owners",
            title: "Owners",
            description:
              "Every task has a person, so progress never becomes a guessing game.",
            href: "/product#projects",
            orb: {
              from: "#e07a4d",
              mid: "#f5a882",
              to: "#8c3a1e",
              glow: "rgba(224,122,77,0.65)",
            },
          },
          {
            id: "focus",
            title: "Focus",
            description:
              "Cut through noise and show the work that matters this week.",
            href: "/product#projects",
            orb: {
              from: "#ff9a6b",
              mid: "#ffc4a3",
              to: "#c45a30",
              glow: "rgba(255,154,107,0.65)",
            },
          },
        ],
      },
      {
        id: "timeline",
        name: "Timeline",
        capabilities: [
          {
            id: "roadmap",
            title: "Roadmap",
            description:
              "See how work stacks across weeks without a separate planning tool.",
            href: "/product#projects",
            orb: {
              from: "#f08a5d",
              mid: "#ffb899",
              to: "#9a4020",
              glow: "rgba(240,138,93,0.65)",
            },
          },
          {
            id: "milestones",
            title: "Milestones",
            description:
              "Milestones that connect ambition to what’s actually shipping.",
            href: "/product#projects",
            orb: {
              from: "#e2a06a",
              mid: "#f5c89a",
              to: "#9a5a30",
              glow: "rgba(226,160,106,0.65)",
            },
          },
          {
            id: "dependencies",
            title: "Dependencies",
            description:
              "Spot blockers early when one delay would cascade into another.",
            href: "/product#projects",
            orb: {
              from: "#ff9f6e",
              mid: "#ffc8a8",
              to: "#b85028",
              glow: "rgba(255,159,110,0.65)",
            },
          },
        ],
      },
      {
        id: "overview",
        name: "Overview",
        capabilities: [
          {
            id: "status",
            title: "Status",
            description:
              "A single view of active projects so leadership isn’t chasing updates.",
            href: "/product#projects",
            orb: {
              from: "#d87848",
              mid: "#f0a070",
              to: "#7a3a18",
              glow: "rgba(216,120,72,0.65)",
            },
          },
          {
            id: "alignment",
            title: "Alignment",
            description:
              "Keep stakeholders on the same page without another status meeting.",
            href: "/product#projects",
            orb: {
              from: "#f08a5d",
              mid: "#ffae88",
              to: "#b04a25",
              glow: "rgba(240,138,93,0.65)",
            },
          },
          {
            id: "delivery",
            title: "Delivery",
            description:
              "Track outcomes, not just activity, as work moves through the team.",
            href: "/product#projects",
            orb: {
              from: "#e07a4d",
              mid: "#f0a888",
              to: "#8c3818",
              glow: "rgba(224,122,77,0.65)",
            },
          },
        ],
      },
    ],
  },
  {
    id: "calendar",
    name: "Calendar",
    description:
      "Events, tasks, and deal deadlines on one shared schedule—day, week, or month.",
    dot: "#b8c92a",
    features: [
      {
        id: "events",
        name: "Events",
        capabilities: [
          {
            id: "meetings",
            title: "Meetings",
            description:
              "A shared calendar for ops, delivery, and client time in one view.",
            href: "/product#calendar",
            orb: {
              from: "#e2f85c",
              mid: "#f0ff9a",
              to: "#8a9a20",
              glow: "rgba(226,248,92,0.6)",
            },
          },
          {
            id: "day-week",
            title: "Day & week",
            description:
              "Switch views without losing context on what’s already booked.",
            href: "/product#calendar",
            orb: {
              from: "#ceff00",
              mid: "#e8ff80",
              to: "#6a8a00",
              glow: "rgba(206,255,0,0.55)",
            },
          },
          {
            id: "ops-time",
            title: "Ops time",
            description:
              "Protect focus blocks and still see what the week demands.",
            href: "/product#calendar",
            orb: {
              from: "#e0ea00",
              mid: "#f2ff66",
              to: "#7a8200",
              glow: "rgba(224,234,0,0.55)",
            },
          },
        ],
      },
      {
        id: "tasks",
        name: "Tasks",
        capabilities: [
          {
            id: "deadlines",
            title: "Deadlines",
            description:
              "Dates that stay tied to projects so nothing slips quietly.",
            href: "/product#calendar",
            orb: {
              from: "#c8d840",
              mid: "#e4f070",
              to: "#6a7410",
              glow: "rgba(200,216,64,0.55)",
            },
          },
          {
            id: "layered",
            title: "Layered",
            description:
              "Toggle tasks beside events so the day plan stays honest.",
            href: "/product#calendar",
            orb: {
              from: "#d4e050",
              mid: "#eef888",
              to: "#7a8418",
              glow: "rgba(212,224,80,0.55)",
            },
          },
          {
            id: "capacity",
            title: "Capacity",
            description:
              "Balance load across people so the week stays realistic.",
            href: "/product#calendar",
            orb: {
              from: "#b8c92a",
              mid: "#d8e860",
              to: "#5a6410",
              glow: "rgba(184,201,42,0.55)",
            },
          },
        ],
      },
      {
        id: "deals",
        name: "Deals",
        capabilities: [
          {
            id: "deal-dates",
            title: "Deal dates",
            description:
              "See pipeline deadlines on the same calendar as everything else.",
            href: "/product#calendar",
            orb: {
              from: "#0b6eff",
              mid: "#4d9aff",
              to: "#062a66",
              glow: "rgba(11,110,255,0.55)",
            },
          },
          {
            id: "close-windows",
            title: "Close windows",
            description:
              "Spot when deals need attention before the month runs out.",
            href: "/product#calendar",
            orb: {
              from: "#30a1f4",
              mid: "#7cc8ff",
              to: "#0b6eff",
              glow: "rgba(48,161,244,0.55)",
            },
          },
          {
            id: "handoffs",
            title: "Handoffs",
            description:
              "Connect calendar time to the CRM records that matter.",
            href: "/product#calendar",
            orb: {
              from: "#6eadc0",
              mid: "#9fd0dc",
              to: "#3d7a8a",
              glow: "rgba(110,173,192,0.55)",
            },
          },
        ],
      },
    ],
  },
  {
    id: "ledger",
    name: "Ledger",
    description:
      "Balances, forecasts, transactions, recipients, and invoices—money you can actually follow.",
    dot: "#8dcf76",
    features: [
      {
        id: "overview",
        name: "Overview",
        capabilities: [
          {
            id: "balances",
            title: "Balances",
            description:
              "See what’s available without digging through bank exports.",
            href: "/product#ledger",
            orb: {
              from: "#8dcf76",
              mid: "#b8e8a4",
              to: "#3d7a2e",
              glow: "rgba(141,207,118,0.65)",
            },
          },
          {
            id: "cash-flow",
            title: "Cash flow",
            description:
              "Balances and movement designed to stay readable and easy to trust.",
            href: "/product#ledger",
            orb: {
              from: "#2b5b00",
              mid: "#5a9a30",
              to: "#0f2800",
              glow: "rgba(43,91,0,0.6)",
            },
          },
          {
            id: "trust",
            title: "Trust",
            description:
              "Numbers that feel accountable—not another opaque finance export.",
            href: "/product#ledger",
            orb: {
              from: "#6eadc0",
              mid: "#9ed0dc",
              to: "#2f5a66",
              glow: "rgba(110,173,192,0.65)",
            },
          },
        ],
      },
      {
        id: "forecast",
        name: "Forecast",
        capabilities: [
          {
            id: "ahead",
            title: "Look ahead",
            description:
              "See what’s coming in and going out before the month surprises you.",
            href: "/product#ledger",
            orb: {
              from: "#8dcf76",
              mid: "#b5e6a0",
              to: "#456828",
              glow: "rgba(141,207,118,0.65)",
            },
          },
          {
            id: "planning",
            title: "Planning",
            description:
              "Forecast views built for operators, not only accountants.",
            href: "/product#ledger",
            orb: {
              from: "#75b85f",
              mid: "#a4d890",
              to: "#2b5b00",
              glow: "rgba(117,184,95,0.65)",
            },
          },
          {
            id: "clarity",
            title: "Clarity",
            description:
              "A simple read on runway and obligations without spreadsheet gymnastics.",
            href: "/product#ledger",
            orb: {
              from: "#a8e090",
              mid: "#d0f5c0",
              to: "#4a8a38",
              glow: "rgba(168,224,144,0.6)",
            },
          },
        ],
      },
      {
        id: "invoices",
        name: "Invoices",
        capabilities: [
          {
            id: "billing",
            title: "Billing",
            description:
              "Send clear invoices that stay connected to the work that earned them.",
            href: "/product#ledger",
            orb: {
              from: "#8dcf76",
              mid: "#b8e8a4",
              to: "#3d7a2e",
              glow: "rgba(141,207,118,0.65)",
            },
          },
          {
            id: "collections",
            title: "Collections",
            description:
              "Know what’s outstanding without digging through spreadsheets.",
            href: "/product#ledger",
            orb: {
              from: "#75b85f",
              mid: "#a4d890",
              to: "#2b5b00",
              glow: "rgba(117,184,95,0.65)",
            },
          },
          {
            id: "recipients",
            title: "Recipients",
            description:
              "Payout recipients and transfers managed alongside your ledger.",
            href: "/product#ledger",
            orb: {
              from: "#2b5b00",
              mid: "#5a9a28",
              to: "#0a1a00",
              glow: "rgba(43,91,0,0.6)",
            },
          },
        ],
      },
    ],
  },
  {
    id: "wallie",
    name: "Wallie",
    description:
      "An AI assistant for research, outreach, and drafts—helpful in chat, quiet when you don’t need it.",
    dot: "#111111",
    features: [
      {
        id: "chat",
        name: "Chat",
        capabilities: [
          {
            id: "threads",
            title: "Threads",
            description:
              "Conversations that stay organized by topic, not lost in a single endless scroll.",
            href: "/product#wallie",
            orb: {
              from: "#111111",
              mid: "#4a4a4a",
              to: "#000000",
              glow: "rgba(17,17,17,0.6)",
            },
          },
          {
            id: "assist",
            title: "Assist",
            description:
              "Ask for the next step across CRM, projects, and finance without leaving chat.",
            href: "/product#wallie",
            orb: {
              from: "#2a2a2a",
              mid: "#5a5a5a",
              to: "#0a0a0a",
              glow: "rgba(42,42,42,0.55)",
            },
          },
          {
            id: "voice",
            title: "Voice",
            description:
              "Talk through a problem when typing isn’t the fastest path.",
            href: "/product#wallie",
            orb: {
              from: "#3a3a3a",
              mid: "#6a6a6a",
              to: "#111111",
              glow: "rgba(58,58,58,0.55)",
            },
          },
        ],
      },
      {
        id: "research",
        name: "Research",
        capabilities: [
          {
            id: "people-search",
            title: "People search",
            description:
              "Find the right contacts and context before you reach out.",
            href: "/product#wallie",
            orb: {
              from: "#0b6eff",
              mid: "#4d9aff",
              to: "#062a66",
              glow: "rgba(11,110,255,0.65)",
            },
          },
          {
            id: "highlights",
            title: "Highlights",
            description:
              "Surface what matters across the workspace in one pass.",
            href: "/product#wallie",
            orb: {
              from: "#1a6dff",
              mid: "#5a9fff",
              to: "#0a3d8c",
              glow: "rgba(11,110,255,0.6)",
            },
          },
          {
            id: "briefings",
            title: "Briefings",
            description:
              "Quick reads that prepare you for the next meeting or follow-up.",
            href: "/product#wallie",
            orb: {
              from: "#30a1f4",
              mid: "#6ec4ff",
              to: "#0066b2",
              glow: "rgba(48,161,244,0.6)",
            },
          },
        ],
      },
      {
        id: "drafts",
        name: "Drafts",
        capabilities: [
          {
            id: "email",
            title: "Email drafts",
            description:
              "Write outreach that stays on-brand and ready to send.",
            href: "/product#wallie",
            orb: {
              from: "#111111",
              mid: "#4a4a4a",
              to: "#000000",
              glow: "rgba(17,17,17,0.6)",
            },
          },
          {
            id: "tone",
            title: "Tone",
            description:
              "Adjust voice without starting from a blank page every time.",
            href: "/product#wallie",
            orb: {
              from: "#2b5b00",
              mid: "#5a9a28",
              to: "#0a1a00",
              glow: "rgba(43,91,0,0.55)",
            },
          },
          {
            id: "review",
            title: "Review",
            description:
              "You stay in control—Wallie drafts, you decide what goes out.",
            href: "/product#wallie",
            orb: {
              from: "#6eadc0",
              mid: "#9ed0dc",
              to: "#2f5a66",
              glow: "rgba(110,173,192,0.55)",
            },
          },
        ],
      },
    ],
  },
  {
    id: "adpilot",
    name: "AdPilot",
    description:
      "Meta campaign sync, spend, and automation—advertising ops that stay visible next to the rest of the business.",
    dot: "#1a7ae0",
    features: [
      {
        id: "dashboard",
        name: "Dashboard",
        capabilities: [
          {
            id: "performance",
            title: "Performance",
            description:
              "Spend and results in one view so campaigns don’t live in a separate silo.",
            href: "/product#adpilot",
            orb: {
              from: "#1a7ae0",
              mid: "#6eb4ff",
              to: "#0a3d70",
              glow: "rgba(26,122,224,0.65)",
            },
          },
          {
            id: "accounts",
            title: "Accounts",
            description:
              "Connected ad accounts that stay synced with the work you’re running.",
            href: "/product#adpilot",
            orb: {
              from: "#0b6eff",
              mid: "#4d9aff",
              to: "#062a66",
              glow: "rgba(11,110,255,0.65)",
            },
          },
          {
            id: "signals",
            title: "Signals",
            description:
              "Spot what’s working—and what needs a budget change—without tab hopping.",
            href: "/product#adpilot",
            orb: {
              from: "#30a1f4",
              mid: "#7cc8ff",
              to: "#0b6eff",
              glow: "rgba(48,161,244,0.65)",
            },
          },
        ],
      },
      {
        id: "campaigns",
        name: "Campaigns",
        capabilities: [
          {
            id: "structure",
            title: "Structure",
            description:
              "Campaigns, ad sets, and creatives organized the way media teams already think.",
            href: "/product#adpilot",
            orb: {
              from: "#0066b2",
              mid: "#4da3e0",
              to: "#083554",
              glow: "rgba(0,102,178,0.65)",
            },
          },
          {
            id: "creatives",
            title: "Creatives",
            description:
              "Preview and review ads without leaving the campaign context.",
            href: "/product#adpilot",
            orb: {
              from: "#1a6dff",
              mid: "#5a9fff",
              to: "#0a3d8c",
              glow: "rgba(11,110,255,0.6)",
            },
          },
          {
            id: "budgets",
            title: "Budgets",
            description:
              "Keep spend decisions next to performance, not buried in another tool.",
            href: "/product#adpilot",
            orb: {
              from: "#0b6eff",
              mid: "#3d8cff",
              to: "#052a66",
              glow: "rgba(11,110,255,0.7)",
            },
          },
        ],
      },
      {
        id: "automation",
        name: "Automation",
        capabilities: [
          {
            id: "rules",
            title: "Rules",
            description:
              "Apply or preview automation against campaigns you authorize.",
            href: "/product#adpilot",
            orb: {
              from: "#ceff00",
              mid: "#e8ff70",
              to: "#6a8800",
              glow: "rgba(206,255,0,0.5)",
            },
          },
          {
            id: "dry-run",
            title: "Dry run",
            description:
              "See what would change before anything goes live.",
            href: "/product#adpilot",
            orb: {
              from: "#e2f85c",
              mid: "#f4ff9e",
              to: "#7a8a18",
              glow: "rgba(226,248,92,0.5)",
            },
          },
          {
            id: "controls",
            title: "Controls",
            description:
              "Automation that stays understandable—no black-box mystery steps.",
            href: "/product#adpilot",
            orb: {
              from: "#e0ea00",
              mid: "#f0fa60",
              to: "#6a7000",
              glow: "rgba(224,234,0,0.5)",
            },
          },
        ],
      },
    ],
  },
  {
    id: "health",
    name: "Health",
    description:
      "Meals, activities, and goals—optional wellness tracking that stays in its own lane.",
    dot: "#5bb8a8",
    features: [
      {
        id: "meals",
        name: "Meals",
        capabilities: [
          {
            id: "nutrition",
            title: "Nutrition",
            description:
              "Log meals and stay aware of intake without turning it into a chore.",
            href: "/product#health",
            orb: {
              from: "#5bb8a8",
              mid: "#8fd4c8",
              to: "#2a6e64",
              glow: "rgba(91,184,168,0.6)",
            },
          },
          {
            id: "calories",
            title: "Calories",
            description:
              "A clear daily read so energy goals stay grounded in reality.",
            href: "/product#health",
            orb: {
              from: "#3d9a8c",
              mid: "#6ec4b6",
              to: "#1e524a",
              glow: "rgba(61,154,140,0.6)",
            },
          },
          {
            id: "habits",
            title: "Habits",
            description:
              "Simple patterns you can keep—not another complicated diet app.",
            href: "/product#health",
            orb: {
              from: "#7ecfc0",
              mid: "#b0e8dc",
              to: "#3a7a70",
              glow: "rgba(126,207,192,0.55)",
            },
          },
        ],
      },
      {
        id: "activities",
        name: "Activities",
        capabilities: [
          {
            id: "workouts",
            title: "Workouts",
            description:
              "Track activity and sync from providers when you want the fuller picture.",
            href: "/product#health",
            orb: {
              from: "#5bb8a8",
              mid: "#8fd4c8",
              to: "#2a6e64",
              glow: "rgba(91,184,168,0.6)",
            },
          },
          {
            id: "movement",
            title: "Movement",
            description:
              "See how the week actually moved—not just what you planned.",
            href: "/product#health",
            orb: {
              from: "#4aa89a",
              mid: "#7ecfc0",
              to: "#245850",
              glow: "rgba(74,168,154,0.6)",
            },
          },
          {
            id: "sync",
            title: "Sync",
            description:
              "Optional connections so logs don’t depend on manual entry alone.",
            href: "/product#health",
            orb: {
              from: "#6eadc0",
              mid: "#9fd0dc",
              to: "#3d7a8a",
              glow: "rgba(110,173,192,0.55)",
            },
          },
        ],
      },
      {
        id: "goals",
        name: "Goals",
        capabilities: [
          {
            id: "targets",
            title: "Targets",
            description:
              "Set goals that stay visible next to meals and activity.",
            href: "/product#health",
            orb: {
              from: "#3d9a8c",
              mid: "#6ec4b6",
              to: "#1e524a",
              glow: "rgba(61,154,140,0.6)",
            },
          },
          {
            id: "progress",
            title: "Progress",
            description:
              "A calm dashboard for how you’re tracking—not a guilt meter.",
            href: "/product#health",
            orb: {
              from: "#5bb8a8",
              mid: "#a0ddd2",
              to: "#2a6e64",
              glow: "rgba(91,184,168,0.55)",
            },
          },
          {
            id: "balance",
            title: "Balance",
            description:
              "Wellness that supports the work—not another product competing for attention.",
            href: "/product#health",
            orb: {
              from: "#7ecfc0",
              mid: "#b0e8dc",
              to: "#3a7a70",
              glow: "rgba(126,207,192,0.55)",
            },
          },
        ],
      },
    ],
  },
];
