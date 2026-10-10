/**
 * Push UAT app_document_template_version rows to production.
 *
 * Usage:
 *   npm run db:push:templates:prod -- --confirm
 *
 * Reads UAT (UAT_DATABASE_URL or DATABASE_URL in .env.uat) and writes to
 * production (DATABASE_URL in .env.production). Requires --confirm.
 */
import postgres from "postgres";

import { applyEnvFile, readEnvFile } from "../../../deployment/lib/pr-env.mjs";
import {
  assertMigrateConfirmed,
  loadMigrateTargetEnv,
  logMigrateTarget,
} from "../lib/migrate-target-env.mts";

import { resolveUatDatabaseUrl } from "./resolve-uat-database-url.mts";

const confirm = process.argv.includes("--confirm");

applyEnvFile(await readEnvFile(".env"));
const uatUrl = resolveUatDatabaseUrl();
const prodUrl = await loadMigrateTargetEnv("prod");
logMigrateTarget("prod", prodUrl);
assertMigrateConfirmed("prod", confirm);

const uat = postgres(uatUrl, { max: 1, prepare: false });
const prod = postgres(prodUrl, { max: 1, prepare: false });

try {
  const rows = await uat`
    select document_template_key, cover_type_id, title, label, version_number,
           template_json, flow_push_down, merge_fields, is_published
    from app_document_template_version
    order by document_template_key, version_number
  `;
  if (rows.length === 0) throw new Error("No UAT templates to push");

  for (const row of rows) {
    await prod.begin(async (tx) => {
      await tx`
        delete from app_document_template_version
        where document_template_key = ${row.document_template_key}
      `;
      await tx`
        insert into app_document_template_version (
          document_template_key,
          cover_type_id,
          title,
          label,
          version_number,
          template_json,
          flow_push_down,
          merge_fields,
          is_published,
          created_when,
          created_by
        ) values (
          ${row.document_template_key},
          ${row.cover_type_id},
          ${row.title},
          ${row.label ?? ""},
          ${row.version_number},
          ${tx.json(row.template_json)},
          ${row.flow_push_down == null ? null : tx.json(row.flow_push_down)},
          ${tx.json(row.merge_fields ?? [])},
          ${row.is_published},
          now(),
          'import-from-uat'
        )
      `;
    });
    console.log(
      "pushed",
      row.document_template_key,
      row.label ? `(${row.label})` : "",
    );
  }

  const check = await prod`
    select document_template_key, label, cover_type_id, is_published, version_number
    from app_document_template_version
    order by document_template_key
  `;
  console.log(JSON.stringify({ pushed: rows.length, prod: check }, null, 2));
} finally {
  await uat.end({ timeout: 5 });
  await prod.end({ timeout: 5 });
}
