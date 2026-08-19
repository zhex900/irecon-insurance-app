#!/usr/bin/env tsx
/**
 * Remove authorised representative(s) and unlink app users.
 * Clients keep stale AR ids until re-seeded (npm run db:seed:ar).
 *
 *   npm run db:clear:ar -- --env=local --dry-run
 *   npm run db:clear:ar -- --env=local
 *   npm run db:clear:ar -- --env=local --id=42
 */
import { resetSharedDbPool } from "../app/lib/db/client";
import { clearAuthorisedRepresentatives } from "./lib/clear-domain-data.mts";
import { runClearDomainScript } from "./lib/clear-domain-cli.mts";

async function main() {
  await runClearDomainScript({
    action: "ar",
    clearFn: clearAuthorisedRepresentatives,
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
