#!/usr/bin/env tsx
/**
 * Remove all policies (and policy_car / policy_car_adjustment via cascade) plus
 * related audit + side-nav recents.
 *
 *   npm run db:clear:policies -- --env=local
 *   npm run db:clear:policies -- --env=uat --dry-run
 *   npm run db:clear:policies -- --env=prod --confirm
 *   npm run db:clear:policies -- --env=local --client-id=<uuid>
 */
import { resetSharedDbPool } from "../app/lib/db/client";
import { clearPolicies } from "./lib/clear-domain-data.mts";
import { runClearDomainScript } from "./lib/clear-domain-cli.mts";

async function main() {
  await runClearDomainScript({
    action: "policies",
    clearFn: clearPolicies,
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
