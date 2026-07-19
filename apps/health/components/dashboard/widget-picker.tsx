"use client";

import * as React from "react";
import { Check, LayoutGrid, Loader2, RotateCcw } from "lucide-react";

import { Switch } from "@walls/ui/switch";
import { cn } from "@walls/utils";

import {
  DASHBOARD_WIDGET_CATALOG,
  DEFAULT_VISIBLE_WIDGETS,
  WIDGET_GROUPS,
  type DashboardWidgetId,
} from "@/lib/dashboard-widgets";

type WidgetPickerProps = {
  visibleWidgets: DashboardWidgetId[];
  onChange: (next: DashboardWidgetId[]) => void;
  saving?: boolean;
};

export function WidgetPicker({
  visibleWidgets,
  onChange,
  saving = false,
}: WidgetPickerProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (id: DashboardWidgetId) => {
    if (visibleWidgets.includes(id)) {
      // Keep at least one widget visible.
      if (visibleWidgets.length <= 1) return;
      onChange(visibleWidgets.filter((widgetId) => widgetId !== id));
      return;
    }
    onChange([...visibleWidgets, id]);
  };

  const resetDefaults = () => {
    onChange([...DEFAULT_VISIBLE_WIDGETS]);
  };

  return (
    <div ref={rootRef} className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors",
          open
            ? "bg-neutral-900 text-white"
            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Widgets
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Customize dashboard widgets"
          className="absolute right-0 top-[calc(100%+0.6rem)] w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-[22px] border border-neutral-200/80 bg-kenoo-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3.5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                Dashboard widgets
              </p>
              <p className="mt-1 text-sm font-light text-neutral-600">
                Choose what shows in your metrics list.
              </p>
            </div>
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-600 transition-colors hover:bg-neutral-200/80"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          <div className="max-h-[min(28rem,60vh)] space-y-4 overflow-y-auto px-2 py-3">
            {WIDGET_GROUPS.map((group) => {
              const widgets = DASHBOARD_WIDGET_CATALOG.filter(
                (widget) => widget.group === group,
              );
              if (widgets.length === 0) return null;

              return (
                <div key={group}>
                  <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                    {group}
                  </p>
                  <ul className="space-y-0.5">
                    {widgets.map((widget) => {
                      const enabled = visibleWidgets.includes(widget.id);
                      return (
                        <li key={widget.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-colors",
                              enabled
                                ? "bg-neutral-50"
                                : "hover:bg-neutral-50/70",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-neutral-900">
                                  {widget.label}
                                </p>
                                {enabled ? (
                                  <Check
                                    className="h-3 w-3 text-[var(--kenoo-sky)]"
                                    aria-hidden
                                  />
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-xs font-light text-neutral-500">
                                {widget.description}
                                {widget.requiresData
                                  ? " · shows when data exists"
                                  : ""}
                              </p>
                            </div>
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => toggle(widget.id)}
                              size="sm"
                              aria-label={`Toggle ${widget.label}`}
                            />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
