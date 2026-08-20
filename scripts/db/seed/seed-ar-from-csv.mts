/**
 * Replace authorised_representative rows from legacy WholesaleBroker.csv.
 *
 * Usage:
 *   npm run db:seed:ar
 *   npm run db:seed:ar -- --file _archive/seeds-source/WholesaleBroker.csv
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { getDb } from "../app/lib/db/client";
import { authorisedRepresentative } from "../app/lib/db/schema";
import { parseWholesaleBrokerCsv } from "./parse-wholesale-broker-csv";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CSV = join(repoRoot, "_archive/seeds-source/WholesaleBroker.csv");

function parseArgs(argv: string[]) {
  let file = DEFAULT_CSV;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--file") {
      const next = argv[++i];
      if (next) {
        file = isAbsolute(next) ? next : resolve(process.cwd(), next);
      }
    }
  }
  return { file };
}

export async function seedAuthorisedRepresentativesFromCsv(csvPath: string) {
  const text = readFileSync(csvPath, "utf8");
  const rows = parseWholesaleBrokerCsv(text);
  if (rows.length === 0) {
    throw new Error(`No WholesaleBroker rows found in ${csvPath}`);
  }

  const db = getDb();

  console.log(`Clearing authorised_representative…`);
  await db.execute(
    sql`TRUNCATE TABLE authorised_representative RESTART IDENTITY CASCADE`,
  );

  console.log(`Seeding ${rows.length} ARs from ${csvPath}…`);
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await db.insert(authorisedRepresentative).values(
      chunk.map((row) => ({
        authorisedRepresentativeId: row.authorisedRepresentativeId,
        fullName: row.fullName,
        companyName: row.companyName,
        arNumber: row.arNumber,
        mobilePhone: row.mobilePhone,
        businessPhone: row.businessPhone,
        email: row.email,
        ownBroker: row.ownBroker,
        createdBy: "seed:wholesale-broker-csv",
      })),
    );
  }

  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('authorised_representative', 'authorised_representative_id'),
      (SELECT COALESCE(MAX(authorised_representative_id), 1) FROM authorised_representative)
    );
  `);

  return rows;
}

async function main() {
  const { file } = parseArgs(process.argv.slice(2));
  const rows = await seedAuthorisedRepresentativesFromCsv(file);
  console.log(`Done. Seeded ${rows.length} authorised representatives.`);
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
