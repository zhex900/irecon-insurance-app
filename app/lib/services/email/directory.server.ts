import { sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import {
  EMAIL_DIRECTORY_KIND_LABEL,
  type EmailDirectoryEntry,
} from "~/lib/email/directory";

export type { EmailDirectoryEntry };
export { EMAIL_DIRECTORY_KIND_LABEL };

type DirectoryRow = {
  kind: string;
  email: string;
  name: string;
  company_name: string | null;
  trading_name: string | null;
};

/**
 * Distinct emails from app users, authorised representatives, and clients
 * for policy compose autocomplete (single round-trip via UNION ALL).
 */
export async function listEmailDirectory(): Promise<EmailDirectoryEntry[]> {
  const db = getDb();
  const rows = await db.execute<DirectoryRow>(sql`
    select 'user'::text as kind, email, full_name as name, null::text as company_name, null::text as trading_name
    from app_user
    where disabled = false and email <> '' and trim(email) <> ''
    union all
    select 'ar'::text, email, full_name as name, company_name, null::text
    from authorised_representative
    where email <> '' and trim(email) <> ''
    union all
    select 'client'::text, email, name, null::text, trading_name
    from client
    where email <> '' and trim(email) <> ''
  `);

  const byEmail = new Map<string, EmailDirectoryEntry>();

  function add(
    kind: EmailDirectoryEntry["kind"],
    emailRaw: string,
    nameRaw: string,
  ) {
    const email = emailRaw.trim().toLowerCase();
    if (!email.includes("@")) return;
    const name = nameRaw.trim();
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, { email, name, kind });
      return;
    }
    // Prefer user → AR → client when the same address appears in multiple tables.
    const rank = { user: 0, ar: 1, client: 2 } as const;
    if (rank[kind] < rank[existing.kind]) {
      byEmail.set(email, {
        email,
        name: name || existing.name,
        kind,
      });
      return;
    }
    if (!existing.name && name) {
      byEmail.set(email, { ...existing, name });
    }
  }

  for (const row of rows) {
    const kind = row.kind as EmailDirectoryEntry["kind"];
    if (kind === "user") {
      add("user", row.email, row.name);
    } else if (kind === "ar") {
      const label = [row.name, row.company_name].filter(Boolean).join(" · ");
      add("ar", row.email, label);
    } else if (kind === "client") {
      const label = [row.name, row.trading_name].filter(Boolean).join(" · ");
      add("client", row.email, label);
    }
  }

  return [...byEmail.values()].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    });
    if (byName !== 0) return byName;
    return a.email.localeCompare(b.email);
  });
}
