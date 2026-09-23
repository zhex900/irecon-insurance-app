/**
 * Push local `car_wording` (Settings → Additional Wording) rows to uat.
 *
 * Usage:
 *   UAT_DATABASE_URL='postgresql://...' npm run db:push:additional-wording:uat
 *   # or
 *   node --env-file=.env --import tsx scripts/push-car-wording-to-uat.mts
 *
 * Reads LOCAL from DATABASE_URL (.env) and upserts into UAT_DATABASE_URL.
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
    select car_wording_id, subject, content
    from car_wording
    order by car_wording_id
  `;
  if (rows.length === 0) {
    throw new Error("No local car_wording rows to push");
  }

  for (const row of rows) {
    await uat`
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

  const check = await uat`
    select car_wording_id, subject, left(content, 80) as content_preview
    from car_wording
    order by car_wording_id
  `;
  console.log(JSON.stringify({ pushed: rows.length, uat: check }, null, 2));
} finally {
  await local.end({ timeout: 5 });
  await uat.end({ timeout: 5 });
}
