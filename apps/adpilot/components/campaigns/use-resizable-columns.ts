"use client";

import * as React from "react";

const MIN_COLUMN_WIDTH = 72;

type WidthMap = Record<string, number>;

function loadWidths(storageKey: string, defaults: WidthMap): WidthMap {
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as WidthMap;
    const merged = { ...defaults };

    for (const key of Object.keys(defaults)) {
      const value = parsed[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        merged[key] = Math.max(MIN_COLUMN_WIDTH, value);
      }
    }

    return merged;
  } catch {
    return defaults;
  }
}

export function useResizableColumns(
  defaults: WidthMap,
  storageKey: string,
) {
  const [widths, setWidths] = React.useState<WidthMap>(defaults);
  const hasLoadedFromStorage = React.useRef(false);

  React.useEffect(() => {
    setWidths(loadWidths(storageKey, defaults));
    hasLoadedFromStorage.current = true;
  }, [storageKey, defaults]);

  React.useEffect(() => {
    if (!hasLoadedFromStorage.current) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // ignore quota / private mode
    }
  }, [storageKey, widths]);

  const startResize = React.useCallback(
    (columnId: string, startX: number) => {
      const startWidth = widths[columnId] ?? defaults[columnId] ?? MIN_COLUMN_WIDTH;

      const onMove = (event: MouseEvent) => {
        const nextWidth = Math.max(
          MIN_COLUMN_WIDTH,
          startWidth + event.clientX - startX,
        );
        setWidths((current) => ({ ...current, [columnId]: nextWidth }));
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [defaults, widths],
  );

  const tableMinWidth = React.useMemo(
    () => Object.values(widths).reduce((sum, width) => sum + width, 0),
    [widths],
  );

  return { widths, startResize, tableMinWidth, minColumnWidth: MIN_COLUMN_WIDTH };
}
