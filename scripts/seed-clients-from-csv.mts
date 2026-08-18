/**
 * Replace client rows from legacy Client.csv.
 *
 * AuthorisedRepresentativeId is not in Client.csv — defaults to the first AR
 * in the DB (or --default-ar). Seed ARs first if needed:
 *   npm run db:seed:ar
 *
 * Usage:
 *   npm run db:seed:clients
 *   npm run db:seed:clients -- --file _archive/seeds-source/Client.csv
 *   npm run db:seed:clients -- --default-ar 1179
 *   npx tsx --env-file=.env.uat scripts/seed-clients-from-csv.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { asc, sql } from "drizzle-orm";
import { getDb } from "../app/lib/db/client";
import { authorisedRepresentative, client } from "../app/lib/db/schema";
import { parseClientCsv } from "./parse-client-csv";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CSV = join(repoRoot, "_archive/seeds-source/Client.csv");

function parseArgs(argv: string[]) {
  let file = DEFAULT_CSV;
  let defaultAr: number | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--file") {
      const next = argv[++i];
      if (next) {
        file = isAbsolute(next) ? next : resolve(process.cwd(), next);
      }
    }
    if (argv[i] === "--default-ar") {
      const next = argv[++i];
      if (next && /^\d+$/.test(next)) {
        defaultAr = Number(next);
      }
    }
  }
  return { file, defaultAr };
}

async function resolveDefaultArId(explicit: number | null): Promise<number> {
  if (explicit != null && explicit > 0) return explicit;

  const db = getDb();
  const [first] = await db
    .select({
      id: authorisedRepresentative.authorisedRepresentativeId,
    })
    .from(authorisedRepresentative)
    .orderBy(asc(authorisedRepresentative.authorisedRepresentativeId))
    .limit(1);

  if (!first) {
    throw new Error(
      "No authorised_representative rows found. Run npm run db:seed:ar first, or pass --default-ar <id>.",
    );
  }
  return first.id;
}

export async function seedClientsFromCsv(
  csvPath: string,
  options?: { defaultArId?: number | null },
) {
  const text = readFileSync(csvPath, "utf8");
  const rows = parseClientCsv(text);
  if (rows.length === 0) {
    throw new Error(`No Client rows found in ${csvPath}`);
  }

  const db = getDb();
  const authorisedRepresentativeId = await resolveDefaultArId(
    options?.defaultArId ?? null,
  );

  console.log(
    `Using authorisedRepresentativeId=${authorisedRepresentativeId} for all clients (not present in Client.csv).`,
  );
  console.log(`Clearing client (CASCADE will remove dependent policies)…`);
  await db.execute(sql`TRUNCATE TABLE client RESTART IDENTITY CASCADE`);

  console.log(`Seeding ${rows.length} clients from ${csvPath}…`);
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await db.insert(client).values(
      chunk.map((row) => ({
        clientId: row.clientId,
        name: row.name,
        tradingName: row.tradingName,
        abn: row.abn,
        phone: row.phone,
        email: row.email,
        accountManagerId: row.accountManagerId,
        clientSourceId: row.clientSourceId,
        authorisedRepresentativeId,
        createdWhen: row.createdWhen ?? new Date(),
        createdBy: "seed:client-csv",
      })),
    );
  }

  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('client', 'client_id'),
      (SELECT COALESCE(MAX(client_id), 1) FROM client)
    );
  `);

  return rows;
}

async function main() {
  const { file, defaultAr } = parseArgs(process.argv.slice(2));
  const rows = await seedClientsFromCsv(file, { defaultArId: defaultAr });
  console.log(`Done. Seeded ${rows.length} clients.`);
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
