#!/usr/bin/env tsx
/**
 * Remove account manager(s). A full wipe cascades to clients and policies.
 *
 *   npm run db:clear:account-managers -- --env=local --dry-run
 *   npm run db:clear:account-managers -- --env=local
 *   npm run db:clear:account-managers -- --env=local --id=7
 */
import { resetSharedDbPool } from "../app/lib/db/client";
import { clearAccountManagers } from "./lib/clear-domain-data.mts";
import { runClearDomainScript } from "./lib/clear-domain-cli.mts";

async function main() {
  await runClearDomainScript({
    action: "account-managers",
    clearFn: clearAccountManagers,
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
