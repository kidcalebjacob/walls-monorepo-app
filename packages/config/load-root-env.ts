import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

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

/** Development loads `.env.local`; production loads `.env` (or Vercel-injected env). */
export function isMonorepoDevelopmentMode(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function getMonorepoEnvFileName(): ".env.local" | ".env" {
  return isMonorepoDevelopmentMode() ? ".env.local" : ".env";
}

export function getMonorepoEnvFilePath(monorepoRoot: string): string {
  return path.join(monorepoRoot, getMonorepoEnvFileName());
}

export function loadMonorepoEnv(appDir: string): string {
  const monorepoRoot = getMonorepoRoot(appDir);
  const isDev = isMonorepoDevelopmentMode();
  const envFile = getMonorepoEnvFilePath(monorepoRoot);

  if (existsSync(envFile)) {
    loadDotenv({ path: envFile });
  } else if (isDev) {
    console.warn(
      `[walls/config] ${envFile} not found. Copy .env.example to .env.local for local development.`,
    );
  } else if (!process.env.VERCEL) {
    // Local production build (`next build`) — optional .env on disk.
    console.warn(
      `[walls/config] ${envFile} not found. Set env vars in Vercel or add a root .env for local production builds.`,
    );
  }

  return monorepoRoot;
}

export function getAppDirFromConfigMeta(metaUrl: string): string {
  return path.dirname(fileURLToPath(metaUrl));
}
