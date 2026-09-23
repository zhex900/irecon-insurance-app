/**
 * Push local app_document_template_version rows to uat.
 *
 * Usage:
 *   UAT_DATABASE_URL='postgresql://...' npm run db:push:templates:uat
 *   # or
 *   node --env-file=.env --import tsx scripts/push-document-templates-to-uat.mts
 *
 * Reads LOCAL from DATABASE_URL (.env) and writes to UAT (UAT_DATABASE_URL or
 * DATABASE_URL in .env.uat).
 */
import postgres from "postgres";

import { resolveUatDatabaseUrl } from "./resolve-uat-database-url.mts";

const localUrl = process.env.DATABASE_URL?.trim();
const uatUrl = resolveUatDatabaseUrl();

if (!localUrl) throw new Error("DATABASE_URL is required (local)");

const local = postgres(localUrl, { max: 1 });
const uat = postgres(uatUrl, { max: 1, prepare: false });

try {
  const rows = await local`
    select document_template_key, cover_type_id, title, label, version_number,
           template_json, flow_push_down, merge_fields, is_published
    from app_document_template_version
    order by document_template_key, version_number
  `;
  if (rows.length === 0) throw new Error("No local templates to push");

  for (const row of rows) {
    await uat.begin(async (tx) => {
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
          'import-from-local'
        )
      `;
    });
    console.log(
      "pushed",
      row.document_template_key,
      row.label ? `(${row.label})` : "",
    );
  }

  const check = await uat`
    select document_template_key, label, cover_type_id, is_published, version_number
    from app_document_template_version
    order by document_template_key
  `;
  console.log(JSON.stringify({ pushed: rows.length, uat: check }, null, 2));
} finally {
  await local.end({ timeout: 5 });
  await uat.end({ timeout: 5 });
}
