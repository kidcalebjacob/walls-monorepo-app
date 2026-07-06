# WALLS Monorepo

pnpm + Turborepo monorepo for the WALLS Entertainment ecosystem.

## Apps


| App             | Path               | Purpose                                                                   |
| --------------- | ------------------ | ------------------------------------------------------------------------- |
| **public-site** | `apps/public-site` | Marketing site ([wallsentertainment.com](https://wallsentertainment.com)) |
| **adpilot**     | `apps/adpilot`     | Ad operations & campaign management                                       |
| **portal**      | `apps/portal`      | Agency auth portal ([walls.agency](https://walls.agency)) — login & password reset |


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

# Agency portal (login / reset password) — http://localhost:3002
pnpm dev:portal

# All apps at once
pnpm dev
```

Dev servers use **webpack** (`next dev --webpack`) instead of Turbopack. Turbopack can hang on first compile in this monorepo (stuck on `Compiling /login ...`); webpack is stable for local development. Production `next build` is unaffected.



## Scripts


| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `pnpm dev`         | Run all apps in dev mode                       |
| `pnpm dev:public`  | Run only the public marketing site (port 3000) |
| `pnpm dev:adpilot` | Run only AdPilot (port 3001)                   |
| `pnpm dev:portal`  | Run only the agency portal (port 3002)         |
| `pnpm build`       | Build all apps                                 |
| `pnpm lint`        | Lint all apps and packages                     |
| `pnpm db:schema` | Refresh `packages/supabase/generated.json` from Postgres |
| `pnpm sync:icons` | Copy shared WALLS favicon into each app (skips apps with a custom `app/icon.*` or `app/favicon.ico`) |




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

Auth lives on **walls.agency** (portal), not on the public marketing site.

### Portal (`apps/portal`)

Login, reset password, and MFA. After login, users are sent to `?redirect=` (another internal app) or their `user_platform.url_redirect`.

### Private internal apps (AdPilot, etc.)

Every non-public app should use `@walls/auth/middleware` so unauthenticated users are sent to the portal:

```ts
// apps/<internal-app>/middleware.ts
import { type NextRequest } from "next/server";
import { handleProtectedAppRequest } from "@walls/auth/middleware";

export async function middleware(request: NextRequest) {
  return handleProtectedAppRequest(request, {
    appSlug: "adpilot", // optional user_app_access check
  });
}

// matcher must be inlined — Next.js cannot parse imported config values
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
```

The middleware checks:

- Valid Supabase session (via portal login cookies)
- MFA completed when enrolled
- `users.status === "active"`
- Optional `user_app_access` for the app slug

Redirects go to `NEXT_PUBLIC_WALLS_AGENCY_URL/login?redirect=<full return URL>`.

### Production SSO

Configure Supabase auth cookies for your parent domain (e.g. `.walls.agency`) so a session from the portal is visible on `adpilot.walls.agency`. Set in root `.env`:

- `NEXT_PUBLIC_WALLS_AGENCY_URL` — portal origin
- `NEXT_PUBLIC_ADPILOT_URL` — AdPilot origin (for safe post-login redirects)

Local dev uses `localhost` origins; cookies are **not** shared across ports — log in via the portal redirect flow when testing AdPilot locally.

### Client auth context

```tsx
// apps/<internal-app>/components/providers.tsx
import { AuthProvider } from "@walls/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

The public site links its Portal button to `NEXT_PUBLIC_WALLS_AGENCY_URL` and does not mount `AuthProvider`.



## Shared UI

```ts
import { Button, buttonVariants } from "@walls/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@walls/ui/sheet-menu";
import { TextRoll } from "@walls/ui/text-roll";
import { cn, extractDomain, validateEmail } from "@walls/utils";
```

Add new Shadcn-style components under `packages/ui/src/components/` as you migrate from the live app.

## Shared favicon

Default WALLS favicon lives in `packages/config/assets/icon.svg`.

- Run `pnpm sync:icons` to copy it into each app as `app/icon.svg`
- Apps with their own `app/favicon.ico`, `app/icon.png`, `app/icon.svg`, etc. are skipped automatically
- Layouts use `createWallsMetadata()` from `@walls/config/metadata` for consistent icon metadata; pass `icons` to override per app:

```ts
import { createWallsMetadata } from "@walls/config/metadata";

export const metadata = createWallsMetadata({
  title: "My App",
  icons: { icon: "/custom-icon.png" }, // optional override
});
```

`@/lib/utils` in any app resolves to `@walls/utils` via each app's `tsconfig.json` — no per-app `lib/utils.ts` file needed. App-specific helpers (e.g. `lib/urls.ts` on the public site) can still live under that app's `lib/` folder.