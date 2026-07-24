"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { cn } from "@walls/utils";

import {
  buildCountryMetricLookup,
  COUNTRY_HEAT_LEGEND_GRADIENT,
  COUNTRY_HOVER_STROKE,
  COUNTRY_LAND_FILL,
  COUNTRY_LAND_STROKE,
  COUNTRY_MAP_METRIC_OPTIONS,
  COUNTRY_OCEAN,
  countryMapSecondaryStats,
  formatCountryDisplayName,
  formatCountryMapMetricValue,
  type CountryMapMetric,
} from "@/lib/country-map";
import type {
  AudienceBreakdownRow,
  AudienceBreakdownsAnalytics,
} from "@/lib/audience-breakdowns";

import { SegmentToggle } from "@/components/ui/segment-toggle";
import { SectionLabel, panelGlassClass } from "./dashboard-metrics";

const GEO_URL = "/geo/countries.geojson";
/** Served from /public - MapLibre v6 needs an explicit worker under Next/webpack. */
const MAP_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const SOURCE_ID = "countries";
const FILL_LAYER = "countries-fill";
const LINE_LAYER = "countries-line";
const HIGHLIGHT_LAYER = "countries-highlight";

type CountryPerformanceMapProps = {
  data: AudienceBreakdownsAnalytics;
  className?: string;
};

type HoverState = {
  iso: string;
  name: string;
  row: AudienceBreakdownRow;
  x: number;
  y: number;
};

type CountryProperties = GeoJsonProperties & {
  iso: string;
  name: string;
  hasData?: boolean;
  fill?: string;
};

type CountryFeature = Feature<Geometry, CountryProperties>;
type CountryCollection = FeatureCollection<Geometry, CountryProperties>;

function emptyStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": COUNTRY_OCEAN },
      },
    ],
  };
}

function paintCountries(
  collection: CountryCollection,
  byIso: Map<string, { color: string }>,
): CountryCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => {
      const iso = String(feature.properties?.iso ?? "").toUpperCase();
      const hit = byIso.get(iso);
      return {
        ...feature,
        id: iso,
        properties: {
          iso,
          name: String(feature.properties?.name ?? iso),
          hasData: Boolean(hit),
          fill: hit?.color ?? COUNTRY_LAND_FILL,
        },
      };
    }),
  };
}

function boundsForDataCountries(
  collection: CountryCollection,
  dataIsos: Set<string>,
): [[number, number], [number, number]] | null {
  if (dataIsos.size === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let found = false;

  const visit = (coords: number[]) => {
    const [lng, lat] = coords;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    found = true;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  };

  const walk = (geometry: Geometry) => {
    if (geometry.type === "Polygon") {
      for (const ring of geometry.coordinates) {
        for (const coord of ring) visit(coord);
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          for (const coord of ring) visit(coord);
        }
      }
    }
  };

  for (const feature of collection.features) {
    const iso = String(feature.properties?.iso ?? "").toUpperCase();
    if (!dataIsos.has(iso) || !feature.geometry) continue;
    walk(feature.geometry);
  }

  if (!found) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function MapControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200/80 bg-white/95 text-neutral-800 shadow-[0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur-md transition hover:bg-white active:scale-95"
    >
      {children}
    </button>
  );
}

export function CountryPerformanceMap({
  data,
  className,
}: CountryPerformanceMapProps) {
  const [metric, setMetric] = React.useState<CountryMapMetric>("spend");
  const [hover, setHover] = React.useState<HoverState | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  const rows = data.byType.country;
  const hasData = data.hasData && rows.some((row) => row.country);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const geoRef = React.useRef<CountryCollection | null>(null);
  const fittedRef = React.useRef(false);
  const metricRef = React.useRef(metric);
  const rowsRef = React.useRef(rows);
  const lookupRef = React.useRef(buildCountryMetricLookup(rows, metric));
  const hoverIsoRef = React.useRef<string | null>(null);

  metricRef.current = metric;
  rowsRef.current = rows;
  lookupRef.current = buildCountryMetricLookup(rows, metric);

  const applyMetricPaint = React.useCallback(() => {
    const map = mapRef.current;
    const geo = geoRef.current;
    if (!map || !geo) return;

    const { byIso } = lookupRef.current;
    const painted = paintCountries(geo, byIso);
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(painted);

    if (!fittedRef.current && byIso.size > 0) {
      const bounds = boundsForDataCountries(painted, new Set(byIso.keys()));
      if (bounds) {
        map.fitBounds(bounds, {
          padding: { top: 48, bottom: 48, left: 48, right: 72 },
          maxZoom: 3.6,
          duration: 900,
        });
        fittedRef.current = true;
      }
    }
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeRaf = 0;
    let resizeSettleTimer = 0;
    let map: MapLibreMap | null = null;

    const clearScheduledResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
      window.clearTimeout(resizeSettleTimer);
      resizeSettleTimer = 0;
    };

    void (async () => {
      const maplibre = await import("maplibre-gl");
      // MapLibre v6 under webpack/Next: GeoJSON tiles never paint without this.
      maplibre.setWorkerUrl(MAP_WORKER_URL);
      if (cancelled || !containerRef.current) return;

      const geoResponse = await fetch(GEO_URL);
      if (!geoResponse.ok) return;
      const geo = (await geoResponse.json()) as CountryCollection;
      if (cancelled) return;
      geoRef.current = geo;

      map = new maplibre.Map({
        container: containerRef.current,
        style: emptyStyle(),
        center: [10, 20],
        zoom: 1.15,
        minZoom: 0.8,
        maxZoom: 6,
        attributionControl: false,
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });

      mapRef.current = map;

      map.on("error", (event) => {
        console.error("[country-map]", event.error);
      });

      map.addControl(
        new maplibre.AttributionControl({ compact: true }),
        "bottom-left",
      );

      const clearHover = () => {
        const activeMap = map;
        const prev = hoverIsoRef.current;
        if (prev && activeMap) {
          activeMap.setFeatureState(
            { source: SOURCE_ID, id: prev },
            { hover: false },
          );
        }
        hoverIsoRef.current = null;
        setHover(null);
        if (activeMap) {
          activeMap.getCanvas().style.cursor = "";
        }
      };

      map.on("load", () => {
        const activeMap = map;
        if (!activeMap || cancelled) return;

        const { byIso } = lookupRef.current;
        const painted = paintCountries(geo, byIso);

        activeMap.addSource(SOURCE_ID, {
          type: "geojson",
          data: painted,
          promoteId: "iso",
          attribution: "Natural Earth",
        });

        activeMap.addLayer({
          id: FILL_LAYER,
          type: "fill",
          source: SOURCE_ID,
          paint: {
            "fill-color": ["get", "fill"],
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.95,
              0.9,
            ],
          },
        });

        activeMap.addLayer({
          id: LINE_LAYER,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": COUNTRY_LAND_STROKE,
            "line-width": 0.6,
            "line-opacity": 0.95,
          },
        });

        activeMap.addLayer({
          id: HIGHLIGHT_LAYER,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": COUNTRY_HOVER_STROKE,
            "line-width": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              1.6,
              0,
            ],
            "line-opacity": 0.85,
          },
        });

        if (byIso.size > 0) {
          const bounds = boundsForDataCountries(
            painted,
            new Set(byIso.keys()),
          );
          if (bounds) {
            activeMap.fitBounds(bounds, {
              padding: { top: 48, bottom: 48, left: 48, right: 72 },
              maxZoom: 3.6,
              duration: 0,
            });
            fittedRef.current = true;
          }
        }

        activeMap.resize();
        setMapReady(true);
      });

      map.on("mousemove", FILL_LAYER, (event: MapLayerMouseEvent) => {
        const activeMap = map;
        if (!activeMap) return;
        const feature = event.features?.[0];
        const iso = String(feature?.properties?.iso ?? "").toUpperCase();
        if (!iso) return;

        const { byIso } = lookupRef.current;
        const hit = byIso.get(iso);
        if (!hit) {
          clearHover();
          return;
        }

        if (hoverIsoRef.current !== iso) {
          if (hoverIsoRef.current) {
            activeMap.setFeatureState(
              { source: SOURCE_ID, id: hoverIsoRef.current },
              { hover: false },
            );
          }
          activeMap.setFeatureState(
            { source: SOURCE_ID, id: iso },
            { hover: true },
          );
          hoverIsoRef.current = iso;
        }

        activeMap.getCanvas().style.cursor = "pointer";
        const point = event.point;
        setHover({
          iso,
          name: formatCountryDisplayName(iso),
          row: hit.row,
          x: point.x,
          y: point.y,
        });
      });

      map.on("mouseleave", FILL_LAYER, () => {
        clearHover();
      });

      map.on("click", FILL_LAYER, (event: MapLayerMouseEvent) => {
        const activeMap = map;
        if (!activeMap) return;
        const feature = event.features?.[0];
        const iso = String(feature?.properties?.iso ?? "").toUpperCase();
        const { byIso } = lookupRef.current;
        if (!iso || !byIso.has(iso) || !feature?.geometry) return;

        const clicked: CountryCollection = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                iso,
                name: String(feature.properties?.name ?? iso),
              },
              geometry: feature.geometry,
            },
          ],
        };
        const bounds = boundsForDataCountries(clicked, new Set([iso]));
        if (bounds) {
          activeMap.fitBounds(bounds, {
            padding: 80,
            maxZoom: 4.5,
            duration: 700,
          });
        }
      });

      // Batch resizes to animation frames and settle after continuous
      // layout changes (pinned sidebar / header) so WebGL doesn't flicker.
      const scheduleResize = () => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = 0;
          map?.resize();
        });
        window.clearTimeout(resizeSettleTimer);
        resizeSettleTimer = window.setTimeout(() => {
          resizeSettleTimer = 0;
          map?.resize();
        }, 320);
      };

      resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(el);
    })();

    return () => {
      cancelled = true;
      clearScheduledResize();
      resizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
      fittedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!mapReady) return;
    applyMetricPaint();
  }, [metric, rows, mapReady, applyMetricPaint]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 220 });
  };

  const resetView = () => {
    const map = mapRef.current;
    const geo = geoRef.current;
    if (!map || !geo) return;
    const { byIso } = buildCountryMetricLookup(rows, metric);
    const bounds = boundsForDataCountries(geo, new Set(byIso.keys()));
    if (bounds) {
      map.fitBounds(bounds, {
        padding: { top: 48, bottom: 48, left: 48, right: 72 },
        maxZoom: 3.6,
        duration: 700,
      });
      return;
    }
    map.easeTo({ center: [10, 20], zoom: 1.15, duration: 700 });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionLabel>Country map</SectionLabel>
        <SegmentToggle
          aria-label="Country map metric"
          value={metric}
          onChange={setMetric}
          options={COUNTRY_MAP_METRIC_OPTIONS}
        />
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[28px]",
          panelGlassClass,
        )}
      >
        <div
          ref={containerRef}
          className="h-[380px] w-full md:h-[460px] [&_.maplibregl-ctrl-attrib]:!bg-transparent [&_.maplibregl-ctrl-attrib]:text-[10px] [&_.maplibregl-ctrl-attrib]:text-neutral-400 [&_.maplibregl-canvas]:outline-none"
          role="img"
          aria-label="Interactive country performance map"
        />

        {!hasData ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[2px]">
            <p className="text-sm font-light text-neutral-500">
              Country performance will appear after Meta sync
            </p>
          </div>
        ) : null}

        <AnimatePresence>
          {hover ? (
            <motion.div
              key={hover.iso}
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none absolute z-20 min-w-[148px] rounded-2xl bg-neutral-950 px-4 py-3 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
              style={{
                left: Math.min(
                  Math.max(hover.x + 14, 12),
                  (containerRef.current?.clientWidth ?? 320) - 180,
                ),
                top: Math.min(
                  Math.max(hover.y - 64, 12),
                  (containerRef.current?.clientHeight ?? 320) - 88,
                ),
              }}
            >
              <p className="text-xl font-semibold tracking-tight text-emerald-300">
                {formatCountryMapMetricValue(hover.row, metric)}
              </p>
              <p className="mt-0.5 text-sm font-medium text-white">
                {hover.name}
              </p>
              <p className="mt-1 text-[11px] font-light text-neutral-400">
                {countryMapSecondaryStats(hover.row)}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-2">
          <MapControlButton label="Zoom in" onClick={() => zoomBy(0.75)}>
            <Plus className="h-4 w-4" strokeWidth={1.8} />
          </MapControlButton>
          <MapControlButton label="Zoom out" onClick={() => zoomBy(-0.75)}>
            <Minus className="h-4 w-4" strokeWidth={1.8} />
          </MapControlButton>
          <MapControlButton label="Reset map view" onClick={resetView}>
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
          </MapControlButton>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-200/70 bg-white/85 px-3 py-1.5 backdrop-blur-md">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            Low
          </span>
          <div
            className="h-2 w-24 rounded-full"
            style={{
              background: COUNTRY_HEAT_LEGEND_GRADIENT,
            }}
          />
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            High
          </span>
        </div>

        <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-full border border-neutral-200/70 bg-white/85 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500 backdrop-blur-md">
          Drag to pan · ⌘/Ctrl + scroll to zoom
        </div>
      </div>
    </div>
  );
}
