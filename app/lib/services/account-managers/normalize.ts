import type { AccountManager } from "~/lib/db/types";

/** Map an account_manager row (or subset) to the app DTO. */
export function normalizeAccountManager(row: {
  accountManagerId: number;
  fullName: string;
  abbrev: string;
  email: string;
  arNumber: string;
  mobile: string;
}): AccountManager {
  return {
    accountManagerId: row.accountManagerId,
    fullName: row.fullName ?? "",
    abbrev: row.abbrev ?? "",
    email: row.email ?? "",
    arNumber: row.arNumber ?? "",
    mobile: row.mobile ?? "",
  };
}
