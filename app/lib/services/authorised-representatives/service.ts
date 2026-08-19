import { asc, eq, ilike, or } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { authorisedRepresentative } from "~/lib/db/schema";
import type { WholesaleBroker } from "~/lib/db/types";
import { NotFoundError } from "~/lib/errors";
import { normalizeAuthorisedRepresentative } from "~/lib/services/authorised-representatives/normalize";

export { normalizeAuthorisedRepresentative };

export type AuthorisedRepresentativeWritable = Omit<
  WholesaleBroker,
  "authorisedRepresentativeId"
>;

export async function listAuthorisedRepresentatives(search?: string) {
  const db = getDb();
  const q = search?.trim();
  const pattern = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const where = pattern
    ? or(
        ilike(authorisedRepresentative.fullName, pattern),
        ilike(authorisedRepresentative.companyName, pattern),
        ilike(authorisedRepresentative.arNumber, pattern),
        ilike(authorisedRepresentative.email, pattern),
      )
    : undefined;

  const rows = await db
    .select()
    .from(authorisedRepresentative)
    .where(where)
    .orderBy(asc(authorisedRepresentative.fullName));

  return rows.map(normalizeAuthorisedRepresentative);
}

export async function getAuthorisedRepresentative(id: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(authorisedRepresentative)
    .where(eq(authorisedRepresentative.authorisedRepresentativeId, id))
    .limit(1);
  return row ? normalizeAuthorisedRepresentative(row) : null;
}

export async function createAuthorisedRepresentative(
  input: AuthorisedRepresentativeWritable,
  createdBy: string,
) {
  const db = getDb();
  const [created] = await db
    .insert(authorisedRepresentative)
    .values({
      fullName: input.fullName.trim(),
      companyName: input.companyName.trim(),
      arNumber: input.arNumber.trim(),
      email: input.email.trim(),
      createdBy,
    })
    .returning();
  return normalizeAuthorisedRepresentative(created);
}

export async function updateAuthorisedRepresentative(
  id: number,
  input: AuthorisedRepresentativeWritable,
) {
  const db = getDb();
  const [updated] = await db
    .update(authorisedRepresentative)
    .set({
      fullName: input.fullName.trim(),
      companyName: input.companyName.trim(),
      arNumber: input.arNumber.trim(),
      email: input.email.trim(),
    })
    .where(eq(authorisedRepresentative.authorisedRepresentativeId, id))
    .returning();
  if (!updated) throw new NotFoundError("Authorised Representative not found");
  return normalizeAuthorisedRepresentative(updated);
}

export async function deleteAuthorisedRepresentative(id: number) {
  const db = getDb();
  await db
    .delete(authorisedRepresentative)
    .where(eq(authorisedRepresentative.authorisedRepresentativeId, id));
}
