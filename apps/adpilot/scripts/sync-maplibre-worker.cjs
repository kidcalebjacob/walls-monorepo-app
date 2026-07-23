#!/usr/bin/env node
/**
 * MapLibre v6 ships a separate worker that Next/webpack won't auto-resolve.
 * Keep /public/maplibre in sync with the installed package version.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "..", "..", "node_modules", "maplibre-gl", "dist");
const out = path.join(root, "public", "maplibre");
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

const localDist = path.join(root, "node_modules", "maplibre-gl", "dist");
const sourceDir = fs.existsSync(path.join(dist, files[0]))
  ? dist
  : localDist;

if (!fs.existsSync(path.join(sourceDir, files[0]))) {
  console.warn("[sync-maplibre-worker] maplibre-gl dist not found; skip");
  process.exit(0);
}

fs.mkdirSync(out, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(out, file));
}
console.log(`[sync-maplibre-worker] synced ${files.length} files → public/maplibre`);
