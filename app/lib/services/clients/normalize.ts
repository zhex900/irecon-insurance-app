import { client } from "~/lib/db/schema";
import type { Client } from "~/lib/db/types";

/** Map a `client` row to the app DTO. */
export function normalizeClient(row: typeof client.$inferSelect): Client {
  return {
    clientId: row.clientId,
    name: row.name ?? "",
    tradingName: row.tradingName ?? "",
    abn: row.abn ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    accountManagerId: row.accountManagerId,
    clientSourceId: row.clientSourceId ?? 16,
    authorisedRepresentativeId: row.authorisedRepresentativeId,
    createdWhen: row.createdWhen.toISOString(),
    createdBy: row.createdBy,
  };
}
