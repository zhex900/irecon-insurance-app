import { and, asc, eq, ne, sql } from "drizzle-orm";
import {
  EMAIL_DIRECTORY_KIND_LABEL,
  type EmailDirectoryEntry,
} from "~/lib/email/directory";
import { getDb } from "~/lib/db/client";
import { appUser, authorisedRepresentative, client } from "~/lib/db/schema";

export type { EmailDirectoryEntry };
export { EMAIL_DIRECTORY_KIND_LABEL };

/**
 * Distinct emails from app users, authorised representatives, and clients
 * for policy compose autocomplete.
 */
export async function listEmailDirectory(): Promise<EmailDirectoryEntry[]> {
  const db = getDb();
  const [users, ars, clients] = await Promise.all([
    db
      .select({
        email: appUser.email,
        name: appUser.fullName,
      })
      .from(appUser)
      .where(
        and(
          eq(appUser.disabled, false),
          ne(appUser.email, ""),
          sql`trim(${appUser.email}) <> ''`,
        ),
      )
      .orderBy(asc(appUser.fullName)),
    db
      .select({
        email: authorisedRepresentative.email,
        name: authorisedRepresentative.fullName,
        companyName: authorisedRepresentative.companyName,
      })
      .from(authorisedRepresentative)
      .where(
        and(
          ne(authorisedRepresentative.email, ""),
          sql`trim(${authorisedRepresentative.email}) <> ''`,
        ),
      )
      .orderBy(asc(authorisedRepresentative.fullName)),
    db
      .select({
        email: client.email,
        name: client.name,
        tradingName: client.tradingName,
      })
      .from(client)
      .where(and(ne(client.email, ""), sql`trim(${client.email}) <> ''`))
      .orderBy(asc(client.name)),
  ]);

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

  for (const row of users) {
    add("user", row.email, row.name);
  }
  for (const row of ars) {
    const label = [row.name, row.companyName].filter(Boolean).join(" · ");
    add("ar", row.email, label);
  }
  for (const row of clients) {
    const label = [row.name, row.tradingName].filter(Boolean).join(" · ");
    add("client", row.email, label);
  }

  return [...byEmail.values()].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    });
    if (byName !== 0) return byName;
    return a.email.localeCompare(b.email);
  });
}
