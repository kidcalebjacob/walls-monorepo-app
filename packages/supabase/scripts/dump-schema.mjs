#!/usr/bin/env node
/**
 * Introspects the Supabase Postgres database and writes packages/supabase/generated.json.
 *
 * Requires SUPABASE_DB_URL in the monorepo root .env (direct/session pooler connection string).
 *
 * Usage from repo root:
 *   pnpm db:schema
 */

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(packageRoot, "../..");
const outputPath = path.join(packageRoot, "generated.json");

function loadEnv() {
  const envPath = path.join(monorepoRoot, ".env");
  const envLocalPath = path.join(monorepoRoot, ".env.local");

  if (!existsSync(envPath) && !existsSync(envLocalPath)) {
    console.error(
      `No .env found at ${envPath}. Copy .env.example and set SUPABASE_DB_URL.`,
    );
    process.exit(1);
  }

  loadDotenv({ path: envPath });
  loadDotenv({ path: envLocalPath, override: true });
}

const SCHEMAS = ["public", "auth", "storage"];

async function query(client, sql, params = []) {
  const { rows } = await client.query(sql, params);
  return rows;
}

async function fetchColumns(client) {
  return query(
    client,
    `
    SELECT
      table_schema,
      table_name,
      column_name,
      ordinal_position,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = ANY($1::text[])
    ORDER BY table_schema, table_name, ordinal_position
    `,
    [SCHEMAS],
  );
}

async function fetchTables(client) {
  return query(
    client,
    `
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = ANY($1::text[])
      AND table_type IN ('BASE TABLE', 'VIEW', 'FOREIGN TABLE')
    ORDER BY table_schema, table_name
    `,
    [SCHEMAS],
  );
}

async function fetchPrimaryKeys(client) {
  return query(
    client,
    `
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = ANY($1::text[])
    ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
    `,
    [SCHEMAS],
  );
}

async function fetchForeignKeys(client) {
  return query(
    client,
    `
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND rc.unique_constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = ANY($1::text[])
    ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position
    `,
    [SCHEMAS],
  );
}

async function fetchUniqueConstraints(client) {
  return query(
    client,
    `
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = ANY($1::text[])
    ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position
    `,
    [SCHEMAS],
  );
}

async function fetchIndexes(client) {
  return query(
    client,
    `
    SELECT
      schemaname AS table_schema,
      tablename AS table_name,
      indexname AS index_name,
      indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = ANY($1::text[])
    ORDER BY schemaname, tablename, indexname
    `,
    [SCHEMAS],
  );
}

async function fetchEnums(client) {
  return query(
    client,
    `
    SELECT
      n.nspname AS schema,
      t.typname AS name,
      e.enumlabel AS value,
      e.enumsortorder AS sort_order
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = ANY($1::text[])
    ORDER BY n.nspname, t.typname, e.enumsortorder
    `,
    [SCHEMAS],
  );
}

async function fetchMaterializedViews(client) {
  return query(
    client,
    `
    SELECT
      schemaname AS table_schema,
      matviewname AS table_name,
      definition
    FROM pg_matviews
    WHERE schemaname = ANY($1::text[])
    ORDER BY schemaname, matviewname
    `,
    [SCHEMAS],
  );
}

async function fetchRls(client) {
  return query(
    client,
    `
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = ANY($1::text[])
    ORDER BY n.nspname, c.relname
    `,
    [SCHEMAS],
  );
}

async function fetchPolicies(client) {
  return query(
    client,
    `
    SELECT
      schemaname AS table_schema,
      tablename AS table_name,
      policyname AS policy_name,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = ANY($1::text[])
    ORDER BY schemaname, tablename, policyname
    `,
    [SCHEMAS],
  );
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function buildSchemaSnapshot({
  tables,
  columns,
  primaryKeys,
  foreignKeys,
  uniqueConstraints,
  indexes,
  enums,
  materializedViews,
  rls,
  policies,
}) {
  const snapshot = {};

  for (const schema of SCHEMAS) {
    snapshot[schema] = {
      tables: {},
      views: {},
      materializedViews: {},
      enums: {},
    };
  }

  for (const row of tables) {
    const bucket =
      row.table_type === "VIEW" ? "views" : "tables";
    snapshot[row.table_schema][bucket][row.table_name] = {
      type: row.table_type,
      columns: [],
      primaryKey: [],
      foreignKeys: [],
      uniqueConstraints: [],
      indexes: [],
      rls: null,
      policies: [],
    };
  }

  for (const row of materializedViews) {
    snapshot[row.table_schema].materializedViews[row.table_name] = {
      definition: row.definition,
      columns: [],
      indexes: [],
    };
  }

  for (const row of columns) {
    const table =
      snapshot[row.table_schema].tables[row.table_name] ??
      snapshot[row.table_schema].views[row.table_name] ??
      snapshot[row.table_schema].materializedViews[row.table_name];
    if (!table) continue;

    table.columns.push({
      name: row.column_name,
      position: row.ordinal_position,
      dataType: row.data_type,
      udtName: row.udt_name,
      nullable: row.is_nullable === "YES",
      default: row.column_default,
      maxLength: row.character_maximum_length,
      numericPrecision: row.numeric_precision,
      numericScale: row.numeric_scale,
    });
  }

  const pkGroups = groupBy(
    primaryKeys,
    (r) => `${r.table_schema}.${r.table_name}`,
  );
  for (const [key, rows] of pkGroups) {
    const [schema, table] = key.split(".");
    const target = snapshot[schema]?.tables[table];
    if (target) target.primaryKey = rows.map((r) => r.column_name);
  }

  const fkGroups = groupBy(
    foreignKeys,
    (r) => `${r.table_schema}.${r.table_name}.${r.constraint_name}`,
  );
  for (const [, rows] of fkGroups) {
    const first = rows[0];
    const target = snapshot[first.table_schema]?.tables[first.table_name];
    if (!target) continue;
    target.foreignKeys.push({
      name: first.constraint_name,
      columns: rows.map((r) => r.column_name),
      references: {
        schema: first.foreign_table_schema,
        table: first.foreign_table_name,
        columns: rows.map((r) => r.foreign_column_name),
      },
      onUpdate: first.update_rule,
      onDelete: first.delete_rule,
    });
  }

  const uqGroups = groupBy(
    uniqueConstraints,
    (r) => `${r.table_schema}.${r.table_name}.${r.constraint_name}`,
  );
  for (const [, rows] of uqGroups) {
    const first = rows[0];
    const target = snapshot[first.table_schema]?.tables[first.table_name];
    if (!target) continue;
    target.uniqueConstraints.push({
      name: first.constraint_name,
      columns: rows.map((r) => r.column_name),
    });
  }

  for (const row of indexes) {
    const target =
      snapshot[row.table_schema]?.tables[row.table_name] ??
      snapshot[row.table_schema]?.materializedViews[row.table_name];
    if (!target) continue;
    target.indexes.push({
      name: row.index_name,
      definition: row.definition,
    });
  }

  const enumGroups = groupBy(enums, (r) => `${r.schema}.${r.name}`);
  for (const [key, rows] of enumGroups) {
    const [schema, name] = key.split(".");
    snapshot[schema].enums[name] = rows.map((r) => r.value);
  }

  for (const row of rls) {
    const target = snapshot[row.table_schema]?.tables[row.table_name];
    if (!target) continue;
    target.rls = {
      enabled: row.rls_enabled,
      forced: row.rls_forced,
    };
  }

  for (const row of policies) {
    const target = snapshot[row.table_schema]?.tables[row.table_name];
    if (!target) continue;
    target.policies.push({
      name: row.policy_name,
      permissive: row.permissive,
      roles: row.roles,
      command: row.cmd,
      using: row.qual,
      withCheck: row.with_check,
    });
  }

  return snapshot;
}

async function main() {
  loadEnv();

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      "SUPABASE_DB_URL is not set. Add your Supabase direct/pooler connection string to .env",
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connecting to Supabase Postgres…");

  try {
    await client.connect();

    const tables = await fetchTables(client);
    const columns = await fetchColumns(client);
    const primaryKeys = await fetchPrimaryKeys(client);
    const foreignKeys = await fetchForeignKeys(client);
    const uniqueConstraints = await fetchUniqueConstraints(client);
    const indexes = await fetchIndexes(client);
    const enums = await fetchEnums(client);
    const materializedViews = await fetchMaterializedViews(client);
    const rls = await fetchRls(client);
    const policies = await fetchPolicies(client);

    const tableCount = tables.filter((t) => t.table_type === "BASE TABLE").length;
    const viewCount = tables.filter((t) => t.table_type === "VIEW").length;

    const output = {
      generatedAt: new Date().toISOString(),
      source: "packages/supabase/scripts/dump-schema.mjs",
      schemasIncluded: SCHEMAS,
      summary: {
        tables: tableCount,
        views: viewCount,
        materializedViews: materializedViews.length,
        enums: new Set(enums.map((e) => `${e.schema}.${e.name}`)).size,
        columns: columns.length,
      },
      schemas: buildSchemaSnapshot({
        tables,
        columns,
        primaryKeys,
        foreignKeys,
        uniqueConstraints,
        indexes,
        enums,
        materializedViews,
        rls,
        policies,
      }),
    };

    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

    console.log(`Wrote ${outputPath}`);
    console.log(
      `  ${tableCount} tables, ${viewCount} views, ${materializedViews.length} materialized views, ${columns.length} columns`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("Schema dump failed:", err.message ?? err);
  process.exit(1);
});
