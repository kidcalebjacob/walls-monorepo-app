"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/auth";
import { wallsToast } from "@/components/ui/walls-toast";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";

export type ScheduleKind = "work" | "personal" | "custom";

/** One contiguous time block on a weekday (multiple allowed per day). */
export type ScheduleIntervalDraft = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type ScheduleDraft = {
  /** Client key — stable across create/save. */
  key: string;
  id: string | null;
  name: string;
  kind: ScheduleKind;
  /** Active weekdays (0=Sun…6=Sat). */
  activeDays: number[];
  /** Time blocks; multiple per day supported. */
  intervals: ScheduleIntervalDraft[];
  /** Soft-deleted existing row. */
  deleted?: boolean;
};

export type UserSchedulesHandle = {
  save: () => Promise<boolean>;
  revert: () => void;
  isDirty: () => boolean;
};

type UserSchedulesSectionProps = {
  userId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  labelClass?: string;
  fieldClass?: string;
};

type HoursMode = "same" | "different";

const DAY_LABELS = [
  { dow: 1, short: "Mon", long: "Monday" },
  { dow: 2, short: "Tue", long: "Tuesday" },
  { dow: 3, short: "Wed", long: "Wednesday" },
  { dow: 4, short: "Thu", long: "Thursday" },
  { dow: 5, short: "Fri", long: "Friday" },
  { dow: 6, short: "Sat", long: "Saturday" },
  { dow: 0, short: "Sun", long: "Sunday" },
] as const;

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";
const SLOT_MINUTES = 30;
/** Inclusive start of the grid (midnight). */
const GRID_START_MINS = 0;
/** Exclusive end of the grid (next midnight). */
const GRID_END_MINS = 24 * 60;

const toTimeInputValue = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.slice(0, 5);
};

const minsToTime = (mins: number): string => {
  if (mins >= 24 * 60) return "24:00";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const timeToMins = (time: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 24 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  // Exclusive end-of-day marker (last slot is 11:30 PM → 12:00 AM).
  if (hours === 24) return minutes === 0 ? 24 * 60 : null;
  return hours * 60 + minutes;
};

const formatSlotLabel = (mins: number): string => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h >= 12 ? "p" : "a";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${hour12}${suffix}`;
  return `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
};

/** Friendly wall-clock label, e.g. "9:00 AM" or "5:30 PM". */
const formatFriendlyTime = (time: string): string => {
  const mins = timeToMins(time);
  if (mins == null) return time;
  if (mins === 24 * 60) return "12:00 AM";
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

/** e.g. "From 9:00 AM to 5:00 PM, then 7:00 PM to 10:00 PM" */
const formatHoursDescription = (
  intervals: ScheduleIntervalDraft[]
): string => {
  const sorted = sortIntervals(intervals);
  if (sorted.length === 0) return "No hours selected yet";

  return sorted
    .map((interval, index) => {
      const range = `${formatFriendlyTime(interval.start_time)} to ${formatFriendlyTime(interval.end_time)}`;
      return index === 0 ? `From ${range}` : `then ${range}`;
    })
    .join(", ");
};

const GRID_SLOTS = (() => {
  const slots: number[] = [];
  for (let m = GRID_START_MINS; m < GRID_END_MINS; m += SLOT_MINUTES) {
    slots.push(m);
  }
  return slots;
})();

/** Map a pointer X position within a slot row to a half-hour slot. */
const slotFromClientX = (
  rowEl: HTMLElement,
  clientX: number
): number | null => {
  const rect = rowEl.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const ratio = (clientX - rect.left) / rect.width;
  if (ratio < 0 || ratio > 1) return null;
  const index = Math.min(
    GRID_SLOTS.length - 1,
    Math.max(0, Math.floor(ratio * GRID_SLOTS.length))
  );
  return GRID_SLOTS[index] ?? null;
};

const sortDayOrder = (a: number, b: number) => {
  const order = (d: number) => (d === 0 ? 7 : d);
  return order(a) - order(b);
};

const sortIntervals = (intervals: ScheduleIntervalDraft[]) =>
  [...intervals].sort((a, b) => {
    const day = sortDayOrder(a.day_of_week, b.day_of_week);
    if (day !== 0) return day;
    return a.start_time.localeCompare(b.start_time);
  });

const intervalsToSlots = (
  intervals: ScheduleIntervalDraft[],
  dow: number
): Set<number> => {
  const slots = new Set<number>();
  for (const interval of intervals) {
    if (interval.day_of_week !== dow) continue;
    const start = timeToMins(interval.start_time);
    const end = timeToMins(interval.end_time);
    if (start == null || end == null || end <= start) continue;
    for (let m = start; m < end; m += SLOT_MINUTES) {
      if (m >= GRID_START_MINS && m < GRID_END_MINS) slots.add(m);
    }
  }
  return slots;
};

const slotsToIntervals = (
  dow: number,
  slots: Set<number>
): ScheduleIntervalDraft[] => {
  const sorted = [...slots].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const intervals: ScheduleIntervalDraft[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  const flush = (endExclusive: number) => {
    intervals.push({
      day_of_week: dow,
      start_time: minsToTime(rangeStart),
      end_time: minsToTime(endExclusive),
    });
  };

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + SLOT_MINUTES) {
      prev = current;
      continue;
    }
    flush(prev + SLOT_MINUTES);
    rangeStart = current;
    prev = current;
  }
  flush(prev + SLOT_MINUTES);
  return intervals;
};

const daySignature = (intervals: ScheduleIntervalDraft[], dow: number) =>
  sortIntervals(intervals.filter((i) => i.day_of_week === dow))
    .map((i) => `${i.start_time}-${i.end_time}`)
    .join("|");

const daysHaveSameHours = (
  activeDays: number[],
  intervals: ScheduleIntervalDraft[]
) => {
  if (activeDays.length <= 1) return true;
  const first = daySignature(intervals, activeDays[0]);
  return activeDays.every((dow) => daySignature(intervals, dow) === first);
};

const inferHoursMode = (
  activeDays: number[],
  intervals: ScheduleIntervalDraft[]
): HoursMode =>
  daysHaveSameHours(activeDays, intervals) ? "same" : "different";

const serialize = (schedules: ScheduleDraft[]) =>
  JSON.stringify(
    schedules.map((s) => ({
      id: s.id,
      name: s.name.trim(),
      kind: s.kind,
      deleted: !!s.deleted,
      activeDays: [...s.activeDays].sort(sortDayOrder),
      intervals: sortIntervals(s.intervals).map((d) => ({
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
      })),
    }))
  );

const defaultWorkIntervals = (): ScheduleIntervalDraft[] =>
  [1, 2, 3, 4, 5].map((day_of_week) => ({
    day_of_week,
    start_time: DEFAULT_START,
    end_time: DEFAULT_END,
  }));

const makeDefaults = (): ScheduleDraft[] => [
  {
    key: crypto.randomUUID(),
    id: null,
    name: "Work",
    kind: "work",
    activeDays: [1, 2, 3, 4, 5],
    intervals: defaultWorkIntervals(),
  },
  {
    key: crypto.randomUUID(),
    id: null,
    name: "Personal",
    kind: "personal",
    activeDays: [],
    intervals: [],
  },
];

function ensureBuiltIns(list: ScheduleDraft[]): ScheduleDraft[] {
  const next = [...list];
  if (!next.some((s) => s.kind === "work" && !s.deleted)) {
    next.unshift({
      key: crypto.randomUUID(),
      id: null,
      name: "Work",
      kind: "work",
      activeDays: [1, 2, 3, 4, 5],
      intervals: defaultWorkIntervals(),
    });
  }
  if (!next.some((s) => s.kind === "personal" && !s.deleted)) {
    next.push({
      key: crypto.randomUUID(),
      id: null,
      name: "Personal",
      kind: "personal",
      activeDays: [],
      intervals: [],
    });
  }
  return next;
}

export const UserSchedulesSection = forwardRef<
  UserSchedulesHandle,
  UserSchedulesSectionProps
>(function UserSchedulesSection(
  {
    userId,
    onDirtyChange,
    labelClass = "text-xs font-normal text-neutral-400 tracking-wide block mb-1",
    fieldClass = "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] bg-transparent w-full placeholder:text-neutral-300",
  },
  ref
) {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [baseline, setBaseline] = useState("[]");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoursModeByKey, setHoursModeByKey] = useState<Record<string, HoursMode>>(
    {}
  );
  const [hoverSlotMins, setHoverSlotMins] = useState<number | null>(null);
  const [hoverDayDow, setHoverDayDow] = useState<number | null>(null);
  const paintDragRef = useRef<{
    dow: number;
    scheduleKey: string;
    mode: HoursMode;
    anchor: number;
    turningOn: boolean;
    startX: number;
    dragging: boolean;
    /** Per-day slot sets captured before this gesture. */
    snapshot: Map<number, Set<number>>;
  } | null>(null);

  const dirty = useMemo(
    () => serialize(schedules) !== baseline,
    [schedules, baseline]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const visibleSchedules = useMemo(
    () => schedules.filter((s) => !s.deleted),
    [schedules]
  );

  const selected = useMemo(
    () =>
      visibleSchedules.find((s) => s.key === selectedKey) ??
      visibleSchedules[0] ??
      null,
    [visibleSchedules, selectedKey]
  );

  useEffect(() => {
    if (!selected && visibleSchedules[0]) {
      setSelectedKey(visibleSchedules[0].key);
    } else if (selected && selected.key !== selectedKey) {
      setSelectedKey(selected.key);
    }
  }, [selected, selectedKey, visibleSchedules]);

  const load = useCallback(async () => {
    if (!userId) {
      setSchedules([]);
      setBaseline("[]");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("user_schedules")
        .select(
          "id, name, kind, user_schedule_days ( day_of_week, start_time, end_time )"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const mapped: ScheduleDraft[] = (data ?? []).map((row) => {
        const daysRaw = Array.isArray(row.user_schedule_days)
          ? row.user_schedule_days
          : [];
        const intervals = sortIntervals(
          daysRaw.map((d) => ({
            day_of_week: Number(d.day_of_week),
            start_time: toTimeInputValue(d.start_time as string) || DEFAULT_START,
            end_time: toTimeInputValue(d.end_time as string) || DEFAULT_END,
          }))
        );
        const activeDays = [
          ...new Set(intervals.map((i) => i.day_of_week)),
        ].sort(sortDayOrder);
        return {
          key: row.id as string,
          id: row.id as string,
          name: (row.name as string) || "Schedule",
          kind: row.kind as ScheduleKind,
          activeDays,
          intervals,
        };
      });

      const ensured = mapped.length === 0 ? makeDefaults() : ensureBuiltIns(mapped);
      const modes: Record<string, HoursMode> = {};
      for (const schedule of ensured) {
        modes[schedule.key] = inferHoursMode(
          schedule.activeDays,
          schedule.intervals
        );
      }
      setSchedules(ensured);
      setHoursModeByKey(modes);
      setBaseline(serialize(ensured));
      setSelectedKey(
        ensured.find((s) => s.kind === "work")?.key ?? ensured[0]?.key ?? null
      );
    } catch (err) {
      console.error("Error loading schedules:", err);
      wallsToast.error("Error", "Failed to load schedules");
      const fallback = makeDefaults();
      const modes: Record<string, HoursMode> = {};
      for (const schedule of fallback) {
        modes[schedule.key] = inferHoursMode(
          schedule.activeDays,
          schedule.intervals
        );
      }
      setSchedules(fallback);
      setHoursModeByKey(modes);
      setBaseline(serialize(fallback));
      setSelectedKey(fallback[0]?.key ?? null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateSelected = useCallback(
    (updater: (current: ScheduleDraft) => ScheduleDraft) => {
      if (!selected) return;
      setSchedules((prev) =>
        prev.map((s) => (s.key === selected.key ? updater(s) : s))
      );
    },
    [selected]
  );

  const rebuildIntervalsFromSlots = (
    activeDays: number[],
    slotMap: Map<number, Set<number>>
  ): ScheduleIntervalDraft[] => {
    const next: ScheduleIntervalDraft[] = [];
    for (const dow of activeDays) {
      next.push(...slotsToIntervals(dow, slotMap.get(dow) ?? new Set()));
    }
    return sortIntervals(next);
  };

  const toggleDay = (dow: number) => {
    updateSelected((current) => {
      const isOn = current.activeDays.includes(dow);
      if (isOn) {
        return {
          ...current,
          activeDays: current.activeDays.filter((d) => d !== dow),
          intervals: current.intervals.filter((i) => i.day_of_week !== dow),
        };
      }

      const mode =
        hoursModeByKey[current.key] ??
        inferHoursMode(current.activeDays, current.intervals);
      const templateDow = current.activeDays[0];
      let newIntervals = current.intervals;

      if (mode === "same" && templateDow != null) {
        const templateSlots = intervalsToSlots(current.intervals, templateDow);
        newIntervals = [
          ...current.intervals.filter((i) => i.day_of_week !== dow),
          ...slotsToIntervals(dow, templateSlots),
        ];
      }

      return {
        ...current,
        activeDays: [...current.activeDays, dow].sort(sortDayOrder),
        intervals: sortIntervals(newIntervals),
      };
    });
  };

  const commitPaintRange = useCallback((currentSlot: number) => {
    const drag = paintDragRef.current;
    if (!drag) return;

    const from = Math.min(drag.anchor, currentSlot);
    const to = Math.max(drag.anchor, currentSlot);

    setSchedules((prev) =>
      prev.map((schedule) => {
        if (schedule.key !== drag.scheduleKey) return schedule;

        const targetDays =
          drag.mode === "same"
            ? schedule.activeDays
            : [drag.dow].filter((d) => schedule.activeDays.includes(d));
        if (targetDays.length === 0) return schedule;

        const slotMap = new Map<number, Set<number>>();
        for (const day of schedule.activeDays) {
          slotMap.set(day, new Set(drag.snapshot.get(day) ?? []));
        }

        for (const day of targetDays) {
          const slots = slotMap.get(day) ?? new Set();
          for (const slot of GRID_SLOTS) {
            if (slot < from || slot > to) continue;
            if (drag.turningOn) slots.add(slot);
            else slots.delete(slot);
          }
          slotMap.set(day, slots);
        }

        return {
          ...schedule,
          intervals: rebuildIntervalsFromSlots(schedule.activeDays, slotMap),
        };
      })
    );
  }, []);

  const startPaint = (
    dow: number,
    rowEl: HTMLElement,
    clientX: number
  ) => {
    if (!selected) return;
    const anchor = slotFromClientX(rowEl, clientX);
    if (anchor == null) return;

    const mode =
      hoursModeByKey[selected.key] ??
      inferHoursMode(selected.activeDays, selected.intervals);

    const snapshot = new Map<number, Set<number>>();
    for (const day of selected.activeDays) {
      snapshot.set(day, intervalsToSlots(selected.intervals, day));
    }

    const sampleDay = mode === "same" ? selected.activeDays[0] : dow;
    const currentlyOn = snapshot.get(sampleDay)?.has(anchor) ?? false;

    paintDragRef.current = {
      dow,
      scheduleKey: selected.key,
      mode,
      anchor,
      turningOn: !currentlyOn,
      startX: clientX,
      dragging: false,
      snapshot,
    };

    commitPaintRange(anchor);
  };

  const paintSlotFromEvent = (rowEl: HTMLElement, clientX: number) => {
    const drag = paintDragRef.current;
    if (!drag) return;

    if (!drag.dragging && Math.abs(clientX - drag.startX) < 4) {
      return;
    }
    drag.dragging = true;

    const currentSlot = slotFromClientX(rowEl, clientX);
    if (currentSlot == null) return;
    commitPaintRange(currentSlot);
  };

  const endPaint = () => {
    paintDragRef.current = null;
  };

  useEffect(() => {
    window.addEventListener("pointerup", endPaint);
    window.addEventListener("pointercancel", endPaint);
    return () => {
      window.removeEventListener("pointerup", endPaint);
      window.removeEventListener("pointercancel", endPaint);
    };
  }, []);

  const setHoursMode = (mode: HoursMode) => {
    if (!selected) return;
    if (mode === "same" && selected.activeDays.length > 0) {
      const templateDow = selected.activeDays[0];
      const templateSlots = intervalsToSlots(selected.intervals, templateDow);
      updateSelected((current) => {
        const slotMap = new Map<number, Set<number>>();
        for (const day of current.activeDays) {
          slotMap.set(day, new Set(templateSlots));
        }
        return {
          ...current,
          intervals: rebuildIntervalsFromSlots(current.activeDays, slotMap),
        };
      });
    }
    setHoursModeByKey((prev) => ({ ...prev, [selected.key]: mode }));
  };

  const addCustom = () => {
    const draft: ScheduleDraft = {
      key: crypto.randomUUID(),
      id: null,
      name: "Custom",
      kind: "custom",
      activeDays: [1, 2, 3, 4, 5],
      intervals: defaultWorkIntervals(),
    };
    setSchedules((prev) => [...prev, draft]);
    setHoursModeByKey((prev) => ({ ...prev, [draft.key]: "same" }));
    setSelectedKey(draft.key);
  };

  const removeCustom = () => {
    if (!selected || selected.kind !== "custom") return;
    setSchedules((prev) => {
      if (selected.id) {
        return prev.map((s) =>
          s.key === selected.key ? { ...s, deleted: true } : s
        );
      }
      return prev.filter((s) => s.key !== selected.key);
    });
    setSelectedKey(null);
  };

  const validate = (list: ScheduleDraft[]): string | null => {
    for (const s of list) {
      if (s.deleted) continue;
      if (!s.name.trim()) return "Every schedule needs a name";
      for (const d of s.intervals) {
        if (!d.start_time || !d.end_time) {
          return `${s.name}: each block needs a start and end`;
        }
        if (d.end_time <= d.start_time) {
          return `${s.name}: end time must be after start`;
        }
      }
    }
    return null;
  };

  const save = useCallback(async () => {
    if (!userId) return true;
    if (!dirty) return true;

    const errorMessage = validate(schedules);
    if (errorMessage) {
      wallsToast.error("Error", errorMessage);
      return false;
    }

    try {
      const supabase = getSupabaseClient();

      for (const schedule of schedules) {
        if (schedule.deleted && schedule.id) {
          const { error } = await supabase
            .from("user_schedules")
            .delete()
            .eq("id", schedule.id)
            .eq("user_id", userId);
          if (error) throw error;
          continue;
        }
        if (schedule.deleted) continue;

        let scheduleId = schedule.id;

        if (!scheduleId) {
          const { data, error } = await supabase
            .from("user_schedules")
            .insert({
              user_id: userId,
              name: schedule.name.trim(),
              kind: schedule.kind,
            })
            .select("id")
            .single();
          if (error) throw error;
          scheduleId = data.id as string;
        } else {
          const { error } = await supabase
            .from("user_schedules")
            .update({ name: schedule.name.trim() })
            .eq("id", scheduleId)
            .eq("user_id", userId);
          if (error) throw error;
        }

        const { error: deleteDaysError } = await supabase
          .from("user_schedule_days")
          .delete()
          .eq("schedule_id", scheduleId);
        if (deleteDaysError) throw deleteDaysError;

        if (schedule.intervals.length > 0) {
          const { error: insertDaysError } = await supabase
            .from("user_schedule_days")
            .insert(
              schedule.intervals.map((d) => ({
                schedule_id: scheduleId,
                day_of_week: d.day_of_week,
                start_time: d.start_time,
                end_time: d.end_time,
              }))
            );
          if (insertDaysError) throw insertDaysError;
        }
      }

      await load();
      return true;
    } catch (err) {
      console.error("Error saving schedules:", err);
      wallsToast.error("Error", "Failed to save schedules");
      return false;
    }
  }, [userId, dirty, schedules, load]);

  const revert = useCallback(() => {
    void load();
  }, [load]);

  useImperativeHandle(
    ref,
    () => ({
      save,
      revert,
      isDirty: () => dirty,
    }),
    [save, revert, dirty]
  );

  if (!userId) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="h-24 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }

  const hoursMode =
    (selected && hoursModeByKey[selected.key]) ||
    (selected
      ? inferHoursMode(selected.activeDays, selected.intervals)
      : "same");
  const activeDaySet = new Set(selected?.activeDays ?? []);
  const gridDays =
    hoursMode === "same"
      ? selected && selected.activeDays.length > 0
        ? [selected.activeDays[0]]
        : []
      : (selected?.activeDays ?? []).slice().sort(sortDayOrder);

  const slotSets = new Map<number, Set<number>>();
  if (selected) {
    for (const dow of selected.activeDays) {
      slotSets.set(dow, intervalsToSlots(selected.intervals, dow));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Schedules</label>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {visibleSchedules.map((schedule) => {
            const isActive = schedule.key === selected?.key;
            return (
              <button
                key={schedule.key}
                type="button"
                onClick={() => setSelectedKey(schedule.key)}
                className={`rounded-none border-b px-0 py-1 text-sm font-light transition-colors ${
                  isActive
                    ? "border-b-[var(--kenoo-sky)] text-neutral-900"
                    : "border-b-transparent text-neutral-400 hover:text-neutral-700"
                }`}
              >
                {schedule.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex items-center gap-1 rounded-none px-1 py-1 text-sm font-light text-neutral-500 hover:text-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {selected && (
        <div className="space-y-5">
          {selected.kind === "custom" && (
            <div className="flex items-end gap-3">
              <FloatingLabelInput
                id="schedule-name"
                type="text"
                label="Schedule name"
                value={selected.name}
                onChange={(e) =>
                  updateSelected((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                containerClassName="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={removeCustom}
                className="mb-2 inline-flex items-center gap-1 text-xs font-light text-neutral-400 hover:text-red-500"
                aria-label="Delete schedule"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}

          <div>
            <label className={labelClass}>Active days</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {DAY_LABELS.map((day) => {
                const on = activeDaySet.has(day.dow);
                return (
                  <button
                    key={day.dow}
                    type="button"
                    onClick={() => toggleDay(day.dow)}
                    aria-pressed={on}
                    className={`min-w-[2.75rem] border-b px-2 py-2 text-sm font-light transition-colors ${
                      on
                        ? "border-b-[var(--kenoo-sky)] text-neutral-900"
                        : "border-b-neutral-200 text-neutral-300 hover:text-neutral-500"
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>

          {selected.activeDays.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className={`${labelClass} mb-0`}>Hours</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setHoursMode("same")}
                    className={`border-b px-0 py-1 text-[11px] font-light transition-colors ${
                      hoursMode === "same"
                        ? "border-b-[var(--kenoo-sky)] text-neutral-900"
                        : "border-b-transparent text-neutral-400 hover:text-neutral-700"
                    }`}
                  >
                    Same every day
                  </button>
                  <button
                    type="button"
                    onClick={() => setHoursMode("different")}
                    className={`border-b px-0 py-1 text-[11px] font-light transition-colors ${
                      hoursMode === "different"
                        ? "border-b-[var(--kenoo-sky)] text-neutral-900"
                        : "border-b-transparent text-neutral-400 hover:text-neutral-700"
                    }`}
                  >
                    Different by day
                  </button>
                </div>
              </div>

              <div
                className="w-full overflow-x-auto pb-1"
                onPointerLeave={() => {
                  setHoverSlotMins(null);
                  setHoverDayDow(null);
                }}
              >
                <div className="w-full space-y-4">
                  <div className="flex w-full items-end">
                    {hoursMode !== "same" && (
                      <div className="w-[2.75rem] shrink-0" />
                    )}
                    <div className="flex min-w-0 flex-1">
                      {GRID_SLOTS.map((slotMins) => (
                        <div
                          key={`label-${slotMins}`}
                          className="min-w-0 flex-1 text-center text-[9px] font-light leading-none text-neutral-400"
                        >
                          {slotMins % 60 === 0 ? formatSlotLabel(slotMins) : ""}
                        </div>
                      ))}
                    </div>
                  </div>

                  {gridDays.map((dow) => {
                    const meta = DAY_LABELS.find((d) => d.dow === dow);
                    const slots = slotSets.get(dow) ?? new Set<number>();
                    const dayIntervals = selected.intervals.filter(
                      (i) => i.day_of_week === dow
                    );
                    return (
                      <div key={`day-${dow}`} className="space-y-1">
                        <div className="flex w-full items-end">
                          {hoursMode !== "same" && (
                            <span className="w-[2.75rem] shrink-0 pb-0.5 text-left text-sm font-light text-neutral-600">
                              {meta?.short}
                            </span>
                          )}
                          <div className="relative min-w-0 flex-1">
                            {hoverSlotMins != null &&
                              hoverDayDow === dow && (
                                <span
                                  className="pointer-events-none absolute bottom-full z-10 mb-0.5 -translate-x-1/2 whitespace-nowrap text-[9px] font-light leading-none text-[var(--kenoo-sky)]"
                                  style={{
                                    left: `${((hoverSlotMins - GRID_START_MINS) / (GRID_END_MINS - GRID_START_MINS) + 0.5 / GRID_SLOTS.length) * 100}%`,
                                  }}
                                >
                                  {formatFriendlyTime(minsToTime(hoverSlotMins))}
                                </span>
                              )}
                            <div
                              className="flex min-w-0 w-full cursor-pointer touch-none select-none"
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                e.preventDefault();
                                const slot = slotFromClientX(
                                  e.currentTarget,
                                  e.clientX
                                );
                                setHoverSlotMins(slot);
                                setHoverDayDow(dow);
                                startPaint(dow, e.currentTarget, e.clientX);
                                e.currentTarget.setPointerCapture(e.pointerId);
                              }}
                              onPointerMove={(e) => {
                                const slot = slotFromClientX(
                                  e.currentTarget,
                                  e.clientX
                                );
                                setHoverSlotMins(slot);
                                setHoverDayDow(dow);
                                if (!paintDragRef.current) return;
                                paintSlotFromEvent(e.currentTarget, e.clientX);
                              }}
                              onPointerUp={(e) => {
                                endPaint();
                                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                                  e.currentTarget.releasePointerCapture(e.pointerId);
                                }
                              }}
                            >
                              {GRID_SLOTS.map((slotMins) => {
                                const on = slots.has(slotMins);
                                return (
                                  <div
                                    key={`${dow}-${slotMins}`}
                                    role="button"
                                    tabIndex={-1}
                                    aria-pressed={on}
                                    aria-label={`${
                                      hoursMode === "same"
                                        ? "All days"
                                        : meta?.long
                                    } ${formatSlotLabel(slotMins)}`}
                                    className={`pointer-events-none h-7 min-w-0 flex-1 border-b transition-colors ${
                                      on
                                        ? "border-b-[var(--kenoo-sky)]"
                                        : "border-b-neutral-200"
                                    }`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        {hoursMode === "different" && (
                          <p className="pl-[2.75rem] text-sm font-light text-neutral-500">
                            {formatHoursDescription(dayIntervals)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {hoursMode === "same" && (
                <p className="text-sm font-light text-neutral-500">
                  {formatHoursDescription(
                    selected.intervals.filter(
                      (i) => i.day_of_week === selected.activeDays[0]
                    )
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-light text-neutral-400">
              Pick at least one day, then tap half-hour slots to set hours.
            </p>
          )}
        </div>
      )}
    </div>
  );
});
