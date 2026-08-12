import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { accountManager, client } from "~/lib/db/schema";
import { ConflictError, NotFoundError } from "~/lib/errors";
import type { AccountManager } from "~/lib/db/types";
import { normalizeAccountManager } from "~/lib/services/account-managers/normalize";

export { normalizeAccountManager };

export type AccountManagerWritable = Omit<AccountManager, "accountManagerId">;

export async function listAccountManagers(): Promise<AccountManager[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(accountManager)
    .orderBy(asc(accountManager.fullName));
  return rows.map(normalizeAccountManager);
}

export async function getAccountManager(id: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(accountManager)
    .where(eq(accountManager.accountManagerId, id))
    .limit(1);
  return row ? normalizeAccountManager(row) : null;
}

export async function createAccountManager(
  input: AccountManagerWritable,
  createdBy: string,
) {
  const db = getDb();
  const [created] = await db
    .insert(accountManager)
    .values({
      fullName: input.fullName.trim(),
      abbrev: input.abbrev.trim(),
      email: input.email.trim(),
      arNumber: input.arNumber.trim(),
      mobile: input.mobile.trim(),
      createdBy,
    })
    .returning();
  return normalizeAccountManager(created);
}

export async function updateAccountManager(
  id: number,
  input: AccountManagerWritable,
) {
  const db = getDb();
  const [updated] = await db
    .update(accountManager)
    .set({
      fullName: input.fullName.trim(),
      abbrev: input.abbrev.trim(),
      email: input.email.trim(),
      arNumber: input.arNumber.trim(),
      mobile: input.mobile.trim(),
    })
    .where(eq(accountManager.accountManagerId, id))
    .returning();
  if (!updated) throw new NotFoundError("Account manager not found");
  return normalizeAccountManager(updated);
}

export async function deleteAccountManager(id: number) {
  const db = getDb();
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(client)
    .where(eq(client.accountManagerId, id));
  if (Number(countRow?.count ?? 0) > 0) {
    throw new ConflictError(
      "This account manager is assigned to clients and cannot be deleted",
    );
  }
  await db
    .delete(accountManager)
    .where(eq(accountManager.accountManagerId, id));
}
