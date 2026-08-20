#!/usr/bin/env tsx
/**
 * Remove client(s), their policies, and related audit + side-nav recents.
 *
 *   npm run db:clear:clients -- --env=local
 *   npm run db:clear:clients -- --env=uat --dry-run
 *   npm run db:clear:clients -- --env=prod --confirm
 *   npm run db:clear:clients -- --env=local --client-id=<uuid>
 */
import { resetSharedDbPool } from "../app/lib/db/client";
import { clearClients } from "./lib/clear-domain-data.mts";
import { runClearDomainScript } from "./lib/clear-domain-cli.mts";

async function main() {
  await runClearDomainScript({
    action: "clients",
    clearFn: clearClients,
  });
  await resetSharedDbPool();
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await resetSharedDbPool().catch(() => {});
    process.exit(1);
  });
