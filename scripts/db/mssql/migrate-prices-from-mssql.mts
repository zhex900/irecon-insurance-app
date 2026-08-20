/**
 * Migrate CAR pricing catalogues from legacy MSSQL → Supabase Postgres
 * (`price*`, `broker_fee_schedule*`) per `_archive/specs/db.txt`.
 *
 * Replaces existing catalogue rows (TRUNCATE + reload). Safe to re-run.
 * Runtime Settings → Prices reads/writes these tables (not JSON).
 *
 * Usage (from repo root):
 *   npm run db:migrate:prices
 *   npx tsx --env-file=.env scripts/migrate-prices-from-mssql.mts
 *   npx tsx --env-file=.env.uat scripts/migrate-prices-from-mssql.mts
 *
 * Options:
 *   --write-json [path]  Also write the export payload (default:
 *                        `_archive/data/prices.json` when flag present)
 *   --dry-run            Export + print counts only; do not touch Postgres
 *
 * MSSQL: `_archive/mssql/.env.mssql` (or SQL_* / Docker SA password).
 * Postgres: `DATABASE_URL` (via `--env-file=.env`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportPricesFromMssql } from "./export-prices-from-mssql.mts";
import { seedPrices } from "./seed-prices";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_JSON = join(repoRoot, "_archive/data/prices.json");

function parseArgs(argv: string[]) {
  let writeJson: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--write-json") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        writeJson = isAbsolute(next) ? next : resolve(process.cwd(), next);
        i += 1;
      } else {
        writeJson = DEFAULT_JSON;
      }
    }
  }
  return { writeJson, dryRun };
}

async function main() {
  const { writeJson, dryRun } = parseArgs(process.argv.slice(2));

  console.log("1/2 Exporting CAR prices from MSSQL…");
  const payload = await exportPricesFromMssql();
  const terrorPostcodes = payload.terror.reduce(
    (sum, schedule) =>
      sum + schedule.tiers.reduce((n, tier) => n + tier.postcodes.length, 0),
    0,
  );
  console.log(
    `  source=${payload.meta.database} exportedAt=${payload.meta.exportedAt}\n` +
      `  prices=${payload.prices.length} stampDuty=${payload.stampDuty.length} ` +
      `esl=${payload.esl.length} terror=${payload.terror.length} ` +
      `(${terrorPostcodes} postcodes) plant=${payload.plant.length} ` +
      `brokerFees=${payload.brokerFees.length}`,
  );

  if (writeJson) {
    mkdirSync(dirname(writeJson), { recursive: true });
    writeFileSync(writeJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`  wrote snapshot ${writeJson}`);
  }

  if (dryRun) {
    console.log("Dry run — skipped Postgres seed.");
    return;
  }

  console.log("2/2 Loading into Postgres price tables…");
  await seedPrices({
    data: payload,
    createdBy: "migrate:mssql",
  });
  console.log("Done. Settings → Prices reads from Postgres.");
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
