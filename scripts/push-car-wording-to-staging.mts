/**
 * Push local `car_wording` (Settings → Additional Wording) rows to staging.
 *
 * Usage:
 *   STAGING_DATABASE_URL='postgresql://...' npm run db:push:additional-wording:staging
 *   # or
 *   node --env-file=.env --import tsx scripts/push-car-wording-to-staging.mts
 *
 * Reads LOCAL from DATABASE_URL (.env) and upserts into STAGING_DATABASE_URL.
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
    select car_wording_id, subject, content
    from car_wording
    order by car_wording_id
  `;
  if (rows.length === 0) {
    throw new Error("No local car_wording rows to push");
  }

  for (const row of rows) {
    await staging`
      insert into car_wording (car_wording_id, subject, content)
      values (
        ${row.car_wording_id},
        ${row.subject},
        ${row.content}
      )
      on conflict (car_wording_id) do update set
        subject = excluded.subject,
        content = excluded.content
    `;
    console.log("pushed", row.car_wording_id, row.subject);
  }

  const check = await staging`
    select car_wording_id, subject, left(content, 80) as content_preview
    from car_wording
    order by car_wording_id
  `;
  console.log(JSON.stringify({ pushed: rows.length, staging: check }, null, 2));
} finally {
  await local.end({ timeout: 5 });
  await staging.end({ timeout: 5 });
}
