/**
 * Push local app_email_template (+ footer image) rows to uat.
 *
 * Usage:
 *   UAT_DATABASE_URL='postgresql://...' npm run db:push:email-templates:uat
 *   # or
 *   node --env-file=.env --import tsx scripts/push-email-templates-to-uat.mts
 *
 * Reads LOCAL from DATABASE_URL (.env) and writes to UAT_DATABASE_URL.
 *
 * Flags:
 *   --templates-only  Skip app_email_footer_image
 *   --footer-only     Skip app_email_template
 */
import postgres from "postgres";

const localUrl = process.env.DATABASE_URL?.trim();
const uatUrl = process.env.UAT_DATABASE_URL?.trim();
const args = new Set(process.argv.slice(2));
const templatesOnly = args.has("--templates-only");
const footerOnly = args.has("--footer-only");

if (templatesOnly && footerOnly) {
  throw new Error("Use only one of --templates-only or --footer-only");
}

if (!localUrl) throw new Error("DATABASE_URL is required (local)");
if (!uatUrl) {
  throw new Error("UAT_DATABASE_URL is required (uat pooler URL, port 6543)");
}
if (/127\.0\.0\.1|localhost/.test(uatUrl)) {
  throw new Error("UAT_DATABASE_URL still points at localhost");
}

const local = postgres(localUrl, { max: 1 });
const uat = postgres(uatUrl, { max: 1, prepare: false });

try {
  const result: {
    templatesPushed: number;
    footerPushed: boolean;
    uatTemplates: unknown[];
    uatFooter: unknown;
  } = {
    templatesPushed: 0,
    footerPushed: false,
    uatTemplates: [],
    uatFooter: null,
  };

  if (!footerOnly) {
    const rows = await local`
      select recipient_type, subject, body, to_email, updated_when, updated_by
      from app_email_template
      order by recipient_type
    `;
    if (rows.length === 0) {
      throw new Error("No local email templates to push");
    }

    for (const row of rows) {
      await uat`
        insert into app_email_template (
          recipient_type,
          subject,
          body,
          to_email,
          updated_when,
          updated_by
        ) values (
          ${row.recipient_type},
          ${row.subject},
          ${row.body},
          ${row.to_email},
          now(),
          'import-from-local'
        )
        on conflict (recipient_type) do update set
          subject = excluded.subject,
          body = excluded.body,
          to_email = excluded.to_email,
          updated_when = excluded.updated_when,
          updated_by = excluded.updated_by
      `;
      console.log("pushed email template", row.recipient_type);
    }
    result.templatesPushed = rows.length;
  }

  if (!templatesOnly) {
    type FooterRow = {
      id: number;
      content_type: string;
      data_uri: string;
      display_width?: number | null;
    };
    let footer: FooterRow | undefined;
    try {
      const rows = await local`
        select id, content_type, data_uri, display_width, updated_when, updated_by
        from app_email_footer_image
        where id = 1
        limit 1
      `;
      footer = rows[0] as FooterRow | undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/display_width/i.test(message)) throw error;
      const rows = await local`
        select id, content_type, data_uri, updated_when, updated_by
        from app_email_footer_image
        where id = 1
        limit 1
      `;
      footer = rows[0] as FooterRow | undefined;
    }

    if (!footer?.data_uri) {
      if (footerOnly) {
        throw new Error("No local email footer image to push");
      }
      console.log("skip footer — no local app_email_footer_image row");
    } else {
      const displayWidth = footer.display_width ?? 520;
      // display_width may be missing on older uat DBs — try full upsert, then fallback.
      try {
        await uat`
          insert into app_email_footer_image (
            id,
            content_type,
            data_uri,
            display_width,
            updated_when,
            updated_by
          ) values (
            1,
            ${footer.content_type},
            ${footer.data_uri},
            ${displayWidth},
            now(),
            'import-from-local'
          )
          on conflict (id) do update set
            content_type = excluded.content_type,
            data_uri = excluded.data_uri,
            display_width = excluded.display_width,
            updated_when = excluded.updated_when,
            updated_by = excluded.updated_by
        `;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/display_width/i.test(message)) throw error;
        console.warn(
          "uat missing display_width — pushing footer without it (run migration)",
        );
        await uat`
          insert into app_email_footer_image (
            id,
            content_type,
            data_uri,
            updated_when,
            updated_by
          ) values (
            1,
            ${footer.content_type},
            ${footer.data_uri},
            now(),
            'import-from-local'
          )
          on conflict (id) do update set
            content_type = excluded.content_type,
            data_uri = excluded.data_uri,
            updated_when = excluded.updated_when,
            updated_by = excluded.updated_by
        `;
      }
      result.footerPushed = true;
      console.log(
        "pushed email footer image",
        `(${footer.content_type}, width=${displayWidth})`,
      );
    }
  }

  if (!footerOnly) {
    result.uatTemplates = await uat`
      select recipient_type,
             length(subject) as subject_len,
             length(body) as body_len,
             to_email,
             updated_by
      from app_email_template
      order by recipient_type
    `;
  }

  if (!templatesOnly) {
    const [footerCheck] = await uat`
      select id,
             content_type,
             length(data_uri) as data_uri_len,
             updated_by
      from app_email_footer_image
      where id = 1
      limit 1
    `;
    result.uatFooter = footerCheck ?? null;
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await local.end({ timeout: 5 });
  await uat.end({ timeout: 5 });
}
