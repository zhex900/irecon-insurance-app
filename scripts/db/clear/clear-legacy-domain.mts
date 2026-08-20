#!/usr/bin/env tsx
/**
 * Remove all legacy-migrated domain rows: policies, clients, account managers, AR.
 *
 *   npm run db:clear:legacy:local
 *   npm run db:clear:legacy:uat -- --dry-run
 *   npm run db:clear:legacy:prod -- --confirm
 */
import { resetSharedDbPool } from "../../../app/lib/db/client";
import { clearLegacyDomain } from "../lib/clear-domain-data.mts";
import { runClearDomainScript } from "../lib/clear-domain-cli.mts";

async function main() {
  await runClearDomainScript({
    action: "legacy-domain",
    clearFn: clearLegacyDomain,
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
