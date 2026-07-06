import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { loadEnvConfig } from "@next/env";

/**
 * Resolve monorepo root from an app directory (e.g. apps/public-site).
 * Do not use process.cwd() — turbo/dev may run with a different cwd.
 */
export function getMonorepoRoot(appDir: string): string {
  const normalized = path.resolve(appDir);
  if (existsSync(path.join(normalized, "pnpm-workspace.yaml"))) {
    return normalized;
  }
  return path.resolve(normalized, "../..");
}

export function loadMonorepoEnv(appDir: string): string {
  const monorepoRoot = getMonorepoRoot(appDir);

  loadDotenv({ path: path.join(monorepoRoot, ".env") });
  loadDotenv({ path: path.join(monorepoRoot, ".env.local"), override: true });
  loadEnvConfig(monorepoRoot);

  return monorepoRoot;
}

export function getAppDirFromConfigMeta(metaUrl: string): string {
  return path.dirname(fileURLToPath(metaUrl));
}
