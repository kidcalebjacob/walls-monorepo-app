# WALLS Monorepo

pnpm + Turborepo monorepo for the WALLS Entertainment ecosystem.

## Apps


| App             | Path               | Purpose                                                                   |
| --------------- | ------------------ | ------------------------------------------------------------------------- |
| **public-site** | `apps/public-site` | Marketing site ([wallsentertainment.com](https://wallsentertainment.com)) |
| **adpilot**     | `apps/adpilot`     | Ad operations & campaign management                                       |
| **portal**      | `apps/portal`      | Agency auth portal ([portal.walls.agency](https://portal.walls.agency)) — login & password reset |
| **wallie**      | `apps/wallie`      | Wallie AI web app ([wallie.walls.agency](https://wallie.walls.agency)) |
| **wallie-mobile** | `apps/wallie-mobile` | Wallie iOS/Android app (Expo dev client) |
| **admin**       | `apps/admin`       | Agency admin ([admin.walls.agency](https://admin.walls.agency)) — users, apps, jobs, teams |


Future apps will live under `apps/`.

## Packages


| Package             | Path                | Purpose                                                 |
| ------------------- | ------------------- | ------------------------------------------------------- |
| **@walls/utils**    | `packages/utils`    | Shared helpers (`cn`, `extractDomain`, `validateEmail`) |
| **@walls/auth**     | `packages/auth`     | Shared Supabase auth context + provider                 |
| **@walls/supabase** | `packages/supabase` | Shared Supabase clients, migrations, schema snapshot (`generated.json`) — see [packages/supabase/README.md](packages/supabase/README.md) |
| **@walls/ui**       | `packages/ui`       | Shared UI components (Shadcn-style)                     |
| **@walls/wallie-core** | `packages/wallie-core` | Shared Wallie chat types, streaming, models          |




## Getting started



### 1. Install dependencies

```bash
pnpm install
```



### 2. Environment variables

Env files live at the **monorepo root** (not inside `apps/`).

| File | When it's used |
| ---- | -------------- |
| **`.env.local`** | **Local development** (`pnpm dev`) — copy from `.env.example` |
| **`.env`** | **Production builds** (`next build` on Vercel or locally) |
| **Vercel dashboard** | Production/preview at deploy time (no file needed on disk) |

```bash
cp .env.example .env.local
```

Fill in your values in **`.env.local`** for local work. Keep production values in **`.env`** for deploys (or set the same keys in Vercel — recommended).

Restart the dev server after changing env files — each app's `next.config.ts` loads env via `@walls/config/load-root-env`.

### 3. Run an app

```bash
# Marketing site — http://localhost:3000
pnpm dev:public

# AdPilot — http://localhost:3001
pnpm dev:adpilot

# Agency portal (login / reset password) — http://localhost:3002
pnpm dev:portal

# Wallie web — http://localhost:3003
pnpm dev:wallie

# Admin — http://localhost:3008
pnpm dev:admin

# All apps at once
pnpm dev
```

Dev servers use **webpack** (`next dev --webpack`) instead of Turbopack. Turbopack can hang on first compile in this monorepo (stuck on `Compiling /login ...`); webpack is stable for local development. Production `next build` is unaffected.

### Kill background local apps

If old `pnpm dev` processes are still holding ports (or you closed the terminal but apps kept running), free ports **3000–3030** on macOS:

```bash
for port in {3000..3030}; do
  lsof -ti tcp:$port | xargs kill -9 2>/dev/null
done
```

That force-kills whatever is listening on each port in the range. Empty ports are skipped. To see what’s still bound first:

```bash
lsof -i tcp:3000-3030
```

### 4. Wallie Mobile (iOS / Android)

Wallie Mobile is an **Expo dev client** app. JavaScript changes hot-reload over Metro; **native changes require a rebuild** (app icon, new native modules like `expo-blur`, permissions, etc.).

#### Start the dev server (required)

From the **repo root**:

```bash
pnpm dev:wallie-mobile
```

Metro runs on **port 8081** by default. Open the Wallie app on your phone/simulator and connect to the dev server URL Metro prints (or enter it manually).

#### Voice on a physical iPhone (second terminal)

Transcription and TTS hit the **Wallie web app**, not Metro. Run this in a **second terminal** while developing voice:

```bash
pnpm dev:wallie
```

Wallie web runs on **http://localhost:3003** with `--hostname 0.0.0.0` so your phone on the same Wi‑Fi can reach your Mac. Ensure `.env.local` includes:

```bash
NEXT_PUBLIC_WALLIE_URL=http://localhost:3003
# Optional: force a specific LAN URL for voice on device
# NEXT_PUBLIC_WALLIE_MOBILE_WEB_URL=http://192.168.x.x:3003
```

#### Rebuild & install on a physical iPhone

Use this when you add/change native dependencies, app icon, splash, or after pulling native-related changes:

```bash
pnpm ios:wallie-mobile
```

This script:

1. Syncs `assets/icon.png` into the native iOS project (home screen icon)
2. Builds the app with Xcode
3. Installs on your connected iPhone via `devicectl`
4. Starts Metro if it is not already running

**If the home screen icon still looks wrong:** delete Wallie from your iPhone, then run `pnpm ios:wallie-mobile` again (iOS caches icons aggressively).

**Simulator instead of device:**

```bash
pnpm ios:wallie-mobile:sim
```

#### When to rebuild vs reload

| Change | What to do |
| ------ | ---------- |
| React screens, hooks, styles | Save file — Metro reloads (shake device → Reload) |
| `.env.local` values used by JS | Restart `pnpm dev:wallie-mobile` |
| App icon, splash, native modules, `app.config.ts` plugins | `pnpm ios:wallie-mobile` |
| Voice not working on device | Ensure `pnpm dev:wallie` is running; same Wi‑Fi; allow Local Network on iOS |

#### Useful commands

```bash
# Metro only (same as dev:wallie-mobile)
pnpm --filter wallie-mobile dev

# Clear Metro cache
pnpm --filter wallie-mobile start:clear

# Sync app icon into existing ios/ folder without full rebuild
pnpm --filter wallie-mobile sync:ios-assets

# Regenerate native ios/ and android/ projects (destructive to local native edits)
pnpm --filter wallie-mobile prebuild
```



## Scripts


| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `pnpm dev`         | Run all apps in dev mode                       |
| `pnpm dev:public`  | Run only the public marketing site (port 3000) |
| `pnpm dev:adpilot` | Run only AdPilot (port 3001)                   |
| `pnpm dev:portal`  | Run only the agency portal (port 3002)         |
| `pnpm dev:wallie`  | Run only Wallie web (port 3003)                |
| `pnpm dev:wallie-mobile` | Run Wallie Mobile Metro bundler (port 8081) |
| `pnpm ios:wallie-mobile` | Build + install Wallie on a connected iPhone |
| `pnpm ios:wallie-mobile:sim` | Build + run Wallie in the iOS Simulator   |
| `pnpm build`       | Build all apps                                 |
| `pnpm lint`        | Lint all apps and packages                     |
| `pnpm db:schema` | Refresh `packages/supabase/generated.json` from live Postgres — [full guide](packages/supabase/README.md#pull-the-latest-database-schema) |
| `pnpm sync:icons` | Copy shared WALLS favicon into each app (skips apps with a custom `app/icon.*` or `app/favicon.ico`) |




## Adding another app

1. Create a new Next.js app under `apps/<name>`
2. Add `@walls/supabase` as a workspace dependency
3. Load root env in `next.config.ts` (copy from `apps/public-site`)
4. Register the app in this README



## Supabase usage

**Schema snapshot:** After applying migrations in Supabase, run `pnpm db:schema` from the repo root to update `packages/supabase/generated.json`. Setup (connection string, troubleshooting): **[packages/supabase/README.md](packages/supabase/README.md)**.

```ts
// Client Component
import { createClient } from "@walls/supabase/client";

// Server Component / Route Handler
import { createClient } from "@walls/supabase/server";
```



## Shared auth

Auth lives on **portal.walls.agency** (agency portal), not on the public marketing site or internal apps like AdPilot.

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

Redirects go to `NEXT_PUBLIC_WALLS_AGENCY_URL/login?redirect=<full return URL>` (e.g. `https://portal.walls.agency/login?redirect=https://adpilot.walls.agency/`).

**Important:** On each internal app’s Vercel project (e.g. AdPilot), set `NEXT_PUBLIC_WALLS_AGENCY_URL` to the **portal** origin (`https://portal.walls.agency`), not the app’s own URL. If it points at AdPilot, unauthenticated users get sent to `adpilot.walls.agency/login` (which does not exist).

### Production SSO

Configure Supabase auth cookies for your parent domain so a portal login is visible on `adpilot.walls.agency`:

```bash
SUPABASE_AUTH_COOKIE_DOMAIN=.walls.agency
```

Also set in **`.env.local`** (dev) or Vercel / **`.env`** (production) on **both portal and AdPilot** projects:

- `NEXT_PUBLIC_WALLS_AGENCY_URL` — portal origin (`https://portal.walls.agency` in production)
- `NEXT_PUBLIC_ADPILOT_URL` — AdPilot origin (for safe post-login redirects)
- `NEXT_PUBLIC_ADMIN_URL` — Admin origin (`https://admin.walls.agency` in production; include on portal so post-login redirects to Admin are allowed)

Local dev uses `localhost` origins; cookies are **not** shared across ports — log in via the portal redirect flow when testing AdPilot locally.

### Deploying to Vercel

Create **one Vercel project per app** with **Root Directory** set to `apps/<name>` (e.g. `apps/adpilot`).

| App | Build command |
| --- | ------------- |
| AdPilot | `cd ../.. && pnpm turbo build --filter=adpilot` |
| Portal | `cd ../.. && pnpm turbo build --filter=portal` |
| Public site | `cd ../.. && pnpm turbo build --filter=public-site` |
| Admin | `cd ../.. && pnpm turbo build --filter=admin` |

Set only the env vars each app needs in that project’s Vercel settings. Legacy walls-app keys (Stripe, Wise, AWS, etc.) are listed in `turbo.json` → `globalPassThroughEnv` so Turborepo won’t warn if they’re still on a project, but **AdPilot does not use them** — you can remove them from the AdPilot Vercel project to keep things clean.

#### Force-deploy the latest GitHub commit

In this monorepo, a push to `main` does **not** always rebuild every Vercel project (Ignored Build Step, canceled deploys, or an app that didn’t change). When one or more apps fall behind, create a **new production deployment from the latest `main` commit** — do **not** use `vercel redeploy`, which rebuilds the *same old commit*.

**Prerequisites:** [Vercel CLI](https://vercel.com/docs/cli) logged in (`vercel login`) and `jq` installed.

**1. Pick the Vercel project name(s)** from this table (this is what you put in the script):

| Vercel project name | App root |
| ------------------- | -------- |
| `kenoo` | `apps/public-site` |
| `kenoo-adpilot` | `apps/adpilot` |
| `kenoo-portal` | `apps/portal` |
| `kenoo-wallie` | `apps/wallie` |
| `kenoo-calendar` | `apps/calendar` |
| `kenoo-health` | `apps/health` |
| `kenoo-settings` | `apps/settings` |
| `kenoo-projects` | `apps/projects` |

Confirm names anytime with:

```bash
vercel project ls --scope walls-entertainment
```

**2. Deploy one project** — replace `PROJECT_NAME` with a name from the table (e.g. `kenoo-calendar`):

```bash
TEAM_ID="team_6bdoPMv1Fh7Y4U8IdhbSEuS2"
TOKEN="$(jq -r '.token' "$HOME/Library/Application Support/com.vercel.cli/auth.json")"
PROJECT_NAME="kenoo-calendar"   # ← change this
REF="main"                      # production branch

curl -sS -X POST "https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}&forceNew=1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROJECT_NAME" --arg ref "$REF" '{
    name: $p,
    project: $p,
    gitSource: {
      type: "github",
      org: "Kenoo-io",
      repo: "kenoo-app",
      ref: $ref
    },
    target: "production"
  }')" | jq '{project: .name, id, url, status: .readyState}'
```

**3. Deploy several at once** — list the project names you need in the `for` loop:

```bash
TEAM_ID="team_6bdoPMv1Fh7Y4U8IdhbSEuS2"
TOKEN="$(jq -r '.token' "$HOME/Library/Application Support/com.vercel.cli/auth.json")"
REF="main"

for PROJECT in kenoo kenoo-calendar kenoo-health; do   # ← edit this list
  echo "Deploying $PROJECT from GitHub@$REF ..."
  curl -sS -X POST "https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}&forceNew=1" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg p "$PROJECT" --arg ref "$REF" '{
      name: $p,
      project: $p,
      gitSource: {
        type: "github",
        org: "Kenoo-io",
        repo: "kenoo-app",
        ref: $ref
      },
      target: "production"
    }')" | jq '{project: .name, id, url, status: .readyState}'
  echo
done
```

**4. Deploy all Kenoo Vercel projects** — copy/paste as-is (every project from the table above):

```bash
TEAM_ID="team_6bdoPMv1Fh7Y4U8IdhbSEuS2"
TOKEN="$(jq -r '.token' "$HOME/Library/Application Support/com.vercel.cli/auth.json")"
REF="main"

for PROJECT in kenoo kenoo-adpilot kenoo-portal kenoo-wallie kenoo-calendar kenoo-health kenoo-settings kenoo-projects; do
  echo "Deploying $PROJECT from GitHub@$REF ..."
  curl -sS -X POST "https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}&forceNew=1" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg p "$PROJECT" --arg ref "$REF" '{
      name: $p,
      project: $p,
      gitSource: {
        type: "github",
        org: "Kenoo-io",
        repo: "kenoo-app",
        ref: $ref
      },
      target: "production"
    }')" | jq '{project: .name, id, url, status: .readyState}'
  echo
done
```

**5. Check status:**

```bash
vercel ls kenoo-calendar --scope walls-entertainment   # ← use your project name
```

Team scope is always `walls-entertainment`. Production deploys from GitHub branch `main` (`REF="main"`). The auth token path above is for macOS; on Linux it’s usually `~/.config/vercel/auth.json` or `~/.local/share/com.vercel.cli/auth.json`.

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

Default WALLS favicon lives in `packages/config/assets/icon.png`.

- Run `pnpm sync:icons` to copy it into each app as `app/icon.png`
- Apps with their own `app/favicon.ico`, `app/icon.ico`, `apple-icon.*`, etc. are skipped automatically
- Layouts use `createWallsMetadata()` from `@walls/config/metadata` for consistent icon metadata; pass `icons` to override per app:

```ts
import { createWallsMetadata } from "@walls/config/metadata";

export const metadata = createWallsMetadata({
  title: "My App",
  icons: { icon: "/custom-icon.png" }, // optional override
});
```
`@/lib/utils` in any app resolves to `@walls/utils` via each app's `tsconfig.json` — no per-app `lib/utils.ts` file needed. App-specific helpers (e.g. `lib/urls.ts` on the public site) can still live under that app's `lib/` folder.