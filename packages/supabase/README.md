# @walls/supabase

Shared Supabase clients for all WALLS apps, plus SQL migrations and a **live schema snapshot** used by agents and tooling.

## Pull the latest database schema

The monorepo keeps an introspected copy of the remote Postgres schema at:

`packages/supabase/generated.json`

Refresh it whenever migrations are applied in Supabase (or tables/columns change in the dashboard).

### 1. One-time setup — database URL

You need a **direct Postgres connection string**, not the anon or service-role API keys.

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Project Settings** → **Database**.
3. Under **Connection string**, choose **URI**.
4. Copy the connection string. Use **Session pooler** (port `5432`) or **Direct connection** — both work for schema introspection.
5. Replace `[YOUR-PASSWORD]` with your database password.

Add it to the **monorepo root** `.env.local` (create from `.env.example` if needed):

```bash
SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

> **Security:** `SUPABASE_DB_URL` is server-only. Never commit it. It stays in `.env.local` (gitignored).

### 2. Run the schema dump

From the **repository root**:

```bash
pnpm db:schema
```

Equivalent, from this package only:

```bash
pnpm --filter @walls/supabase db:schema
```

On success you should see output similar to:

```text
Wrote packages/supabase/generated.json
  tables: …
  views: …
  columns: …
```

### 3. Commit the snapshot (recommended)

After pulling schema, commit the updated file so the team and Cursor agents see the same structure:

```bash
git add packages/supabase/generated.json
git commit -m "chore: refresh Supabase schema snapshot"
```

---

## Typical workflow after schema changes

When you add or change tables (e.g. new `ad_*` AdPilot tables):

1. **Apply SQL to Supabase** — run the migration file in the SQL Editor, or apply via your usual process.
   - Migration files live in `packages/supabase/migrations/`.
2. **Pull schema into the repo:**
   ```bash
   pnpm db:schema
   ```
3. **Commit** `generated.json` (and the migration `.sql` file if it is new).

`pnpm db:schema` **reads** the live database; it does **not** push migrations. Apply SQL in Supabase first, then dump.

---

## What gets generated

| Output | Description |
|--------|-------------|
| `generated.json` | Full introspection of `public`, `auth`, and `storage` schemas: tables, columns, types, indexes, foreign keys, RLS flags |

The dump script is `scripts/dump-schema.mjs`. It uses the `pg` client and `SUPABASE_DB_URL`.

---

## Migrations

Hand-written SQL migrations are stored here:

```
packages/supabase/migrations/
```

Name new files with a timestamp prefix so they sort alphabetically, e.g.:

```
20260707100000_adpilot_budget_automation.sql
```

Use the `ad_` prefix for AdPilot-related tables when possible (easier to find among ~180+ tables).

---

## App usage

```ts
// Client Component
import { createClient } from "@walls/supabase/client";

// Server Component / Route Handler
import { createClient } from "@walls/supabase/server";

// Server-only admin (service role)
import { createAdminClient } from "@walls/supabase/admin";
```

Required env vars for apps (root `.env.local` / Vercel):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, for admin client)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `SUPABASE_DB_URL is not set` | Add the URI to root `.env.local` and re-run `pnpm db:schema`. |
| Connection refused / timeout | Try **Session pooler** URI from the dashboard, or allow your IP under **Database → Network restrictions**. |
| Schema missing new tables | Confirm the migration ran successfully in Supabase SQL Editor, then run `pnpm db:schema` again. |
| `pnpm db:schema` fails on `pg` | Run `pnpm install` from the repo root. |

---

## Related commands

| Command | Where | Purpose |
|---------|-------|---------|
| `pnpm db:schema` | Repo root | Refresh `generated.json` |
| `pnpm --filter @walls/supabase db:schema` | Anywhere | Same as above |
