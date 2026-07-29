/**
 * Push local app_document_template_version rows to staging.
 *
 * Usage:
 *   STAGING_DATABASE_URL='postgresql://...' npm run db:push:templates:staging
 *   # or
 *   node --env-file=.env --import tsx scripts/push-document-templates-to-staging.mts
 *
 * Reads LOCAL from DATABASE_URL (.env) and writes to STAGING_DATABASE_URL.
 */
import postgres from "postgres";

const localUrl = process.env.DATABASE_URL?.trim();
const stagingUrl = process.env.STAGING_DATABASE_URL?.trim();

if (!localUrl) throw new Error("DATABASE_URL is required (local)");
if (!stagingUrl) {
  throw new Error(
    "STAGING_DATABASE_URL is required (staging pooler URL, port 6543)",
  );
}
if (/127\.0\.0\.1|localhost/.test(stagingUrl)) {
  throw new Error("STAGING_DATABASE_URL still points at localhost");
}

const local = postgres(localUrl, { max: 1 });
const staging = postgres(stagingUrl, { max: 1, prepare: false });

try {
  const rows = await local`
    select document_template_key, cover_type_id, title, version_number,
           template_json, flow_push_down, merge_fields, is_published
    from app_document_template_version
    order by document_template_key, version_number
  `;
  if (rows.length === 0) throw new Error("No local templates to push");

  for (const row of rows) {
    await staging.begin(async (tx) => {
      await tx`
        delete from app_document_template_version
        where document_template_key = ${row.document_template_key}
      `;
      await tx`
        insert into app_document_template_version (
          document_template_key,
          cover_type_id,
          title,
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
    console.log("pushed", row.document_template_key);
  }

  const check = await staging`
    select document_template_key, cover_type_id, is_published, version_number
    from app_document_template_version
    order by document_template_key
  `;
  console.log(JSON.stringify({ pushed: rows.length, staging: check }, null, 2));
} finally {
  await local.end({ timeout: 5 });
  await staging.end({ timeout: 5 });
}
