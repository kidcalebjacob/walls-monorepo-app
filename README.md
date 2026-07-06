# WALLS Monorepo

pnpm + Turborepo monorepo for the WALLS Entertainment ecosystem.

## Apps


| App             | Path               | Purpose                                                                   |
| --------------- | ------------------ | ------------------------------------------------------------------------- |
| **public-site** | `apps/public-site` | Marketing site ([wallsentertainment.com](https://wallsentertainment.com)) |
| **adpilot**     | `apps/adpilot`     | Ad operations & campaign management                                       |


Future apps (e.g. `agents.walls.agency`) will live under `apps/`.

## Packages


| Package             | Path                | Purpose                                                 |
| ------------------- | ------------------- | ------------------------------------------------------- |
| **@walls/utils**    | `packages/utils`    | Shared helpers (`cn`, `extractDomain`, `validateEmail`) |
| **@walls/auth**     | `packages/auth`     | Shared Supabase auth context + provider                 |
| **@walls/supabase** | `packages/supabase` | Shared Supabase browser + server clients                |
| **@walls/ui**       | `packages/ui`       | Shared UI components (Shadcn-style)                     |




## Getting started



### 1. Install dependencies

```bash
pnpm install
```



### 2. Environment variables

All apps read from the **root** `.env` file (not per-app).

```bash
cp .env.example .env
```

Fill in your Supabase project values at the **monorepo root** (not inside `apps/`):

```bash
cp .env.example .env
```

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Restart the dev server after changing `.env` — Next.js reads root env via `loadEnvConfig` in each app's `next.config.ts`.

### 3. Run an app

```bash
# Marketing site — http://localhost:3000
pnpm dev:public

# AdPilot — http://localhost:3001
pnpm dev:adpilot

# All apps at once
pnpm dev
```



## Scripts


| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `pnpm dev`         | Run all apps in dev mode                       |
| `pnpm dev:public`  | Run only the public marketing site (port 3000) |
| `pnpm dev:adpilot` | Run only AdPilot (port 3001)                   |
| `pnpm build`       | Build all apps                                 |
| `pnpm lint`        | Lint all apps and packages                     |




## Adding another app

1. Create a new Next.js app under `apps/<name>`
2. Add `@walls/supabase` as a workspace dependency
3. Load root env in `next.config.ts` (copy from `apps/public-site`)
4. Register the app in this README



## Supabase usage

```ts
// Client Component
import { createClient } from "@walls/supabase/client";

// Server Component / Route Handler
import { createClient } from "@walls/supabase/server";
```



## Shared auth

Auth lives on **walls.agency** (and internal apps like AdPilot), not on the public marketing site.

`@walls/auth` is for agency / app domains only. Wire it in those apps:

```tsx
// apps/<app>/components/providers.tsx
"use client";
import { AuthProvider } from "@walls/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

The public site (`apps/public-site`) links its Portal button to `NEXT_PUBLIC_WALLS_AGENCY_URL` and does not mount `AuthProvider`.

```ts
// In agency / internal app client components
import { useAuth, getSupabaseClient } from "@walls/auth";
```



## Shared UI

```ts
import { Button, buttonVariants } from "@walls/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@walls/ui/sheet-menu";
import { TextRoll } from "@walls/ui/text-roll";
import { cn, extractDomain, validateEmail } from "@walls/utils";
```

Add new Shadcn-style components under `packages/ui/src/components/` as you migrate from the live app.

`@/lib/utils` in any app resolves to `@walls/utils` via each app's `tsconfig.json` — no per-app `lib/utils.ts` file needed. App-specific helpers (e.g. `lib/urls.ts` on the public site) can still live under that app's `lib/` folder.