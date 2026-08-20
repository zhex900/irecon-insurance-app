/**
 * Export CAR pricing catalogues from legacy MSSQL.
 *
 * Prefer `npm run db:migrate:prices` to load straight into Postgres.
 * This script writes an optional JSON snapshot for offline `db:seed:prices`.
 *
 * Usage (from repo root):
 *   npm run db:export:prices
 *   npx tsx scripts/export-prices-from-mssql.mts --out _archive/data/prices.json
 *
 * Connection: _archive/mssql/.env.mssql, or SA password from Docker container `sqlserver`.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import type { PricesPayload } from "./lib/prices-payload";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = join(repoRoot, "_archive/data/prices.json");
const ENV_FILE = join(repoRoot, "_archive/mssql/.env.mssql");

type PricesFile = Required<
  Pick<
    PricesPayload,
    "meta" | "prices" | "stampDuty" | "esl" | "terror" | "plant" | "brokerFees"
  >
> & {
  meta: NonNullable<PricesPayload["meta"]>;
  brokerFees: NonNullable<PricesPayload["brokerFees"]>;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  let out = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") {
      const next = argv[++i];
      if (next) out = isAbsolute(next) ? next : resolve(process.cwd(), next);
    }
  }
  return { out };
}

function num(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  throw new Error(`Invalid date: ${raw}`);
}

async function resolvePassword(): Promise<string> {
  if (process.env.SQL_PASSWORD?.trim()) return process.env.SQL_PASSWORD.trim();
  const container = process.env.MSSQL_DOCKER_CONTAINER || "sqlserver";
  const { execFileSync } = await import("node:child_process");
  const envDump = execFileSync(
    "docker",
    [
      "inspect",
      container,
      "--format",
      "{{range .Config.Env}}{{println .}}{{end}}",
    ],
    { encoding: "utf8" },
  );
  for (const line of envDump.split("\n")) {
    if (
      line.startsWith("SA_PASSWORD=") ||
      line.startsWith("MSSQL_SA_PASSWORD=")
    ) {
      return line.slice(line.indexOf("=") + 1);
    }
  }
  throw new Error(
    "SQL_PASSWORD not set and could not read SA password from Docker. Create _archive/mssql/.env.mssql.",
  );
}

async function connect() {
  loadEnvFile(ENV_FILE);
  const password = await resolvePassword();
  const config: sql.config = {
    server: process.env.SERVER_NAME || process.env.DB_SERVER || "127.0.0.1",
    port: Number(process.env.SQL_PORT || process.env.DB_PORT || 1433),
    database:
      process.env.DATABASE_NAME || process.env.DB_DATABASE || "vs434253_1",
    user: process.env.SQL_USERNAME || process.env.DB_USER || "sa",
    password,
    options: {
      encrypt: (process.env.DB_ENCRYPT ?? "true") !== "false",
      trustServerCertificate:
        (process.env.TRUST_SERVER_CERTIFICATE ??
          process.env.DB_TRUST_SERVER_CERTIFICATE ??
          "true") !== "false",
    },
    requestTimeout: 120_000,
  };
  const pool = await sql.connect(config);
  return { pool, database: config.database! };
}

function markLatestPublished<
  T extends { dateStart: string; published: boolean },
>(rows: T[]): T[] {
  if (rows.length === 0) return rows;
  const sorted = [...rows].sort((a, b) =>
    a.dateStart.localeCompare(b.dateStart),
  );
  const latest = sorted[sorted.length - 1]!.dateStart;
  return rows.map((row) => ({
    ...row,
    published: row.dateStart === latest,
  }));
}

export async function exportPricesFromMssql(): Promise<PricesFile> {
  const { pool, database } = await connect();
  try {
    const [
      priceRows,
      stampRows,
      eslRows,
      plantRows,
      terrorRateRows,
      terrorPostcodeRows,
      brokerRows,
    ] = await Promise.all([
      pool.request().query(
        `SELECT CoverType, LowerTurnover, UpperTurnover, VersionNumber,
                  CWRate, TenMilLiability, TwentyMilLiability,
                  CWMinPrem, TenMilMinPrem, TwentyMilMinPrem, DateApplied
           FROM dbo.CAR_PriceFile
           ORDER BY VersionNumber, CoverType, LowerTurnover`,
      ),
      pool.request().query(
        `SELECT CAR_StampDutyId, State, Rate, VersionNumber, DateApplied, Section
           FROM dbo.CAR_StampDuty
           ORDER BY VersionNumber, State, Section`,
      ),
      pool.request().query(
        `SELECT State, ConstructionRate, PlantRate, VersionNumber, DateApplied
           FROM dbo.CAR_ESL
           ORDER BY VersionNumber, State`,
      ),
      pool.request().query(
        `SELECT CAR_PlantRateId, VersionNumber, Rate, DateApplied, PlantMinValue, PlantMaxValue
           FROM dbo.CAR_PlantRate
           ORDER BY VersionNumber`,
      ),
      pool.request().query(
        `SELECT CAR_TerrorismRateId, Tier, Rate, StartDate
           FROM dbo.CAR_TerrorismRate
           ORDER BY StartDate, Tier`,
      ),
      pool.request().query(
        `SELECT CAR_TerrorismRateId, Postcode, State
           FROM dbo.CAR_TerrorismPostcode
           ORDER BY CAR_TerrorismRateId, Postcode`,
      ),
      pool.request().query(
        `SELECT bf.StartDate, bfs.Name, bfs.SortOrder, bfr.Base, bfr.Rate
           FROM dbo.BrokerFee bf
           INNER JOIN dbo.BrokerFeeSetup bfs ON bfs.BrokerFeeSetupId = bf.BrokerFeeSetupId
           LEFT JOIN dbo.BrokerFeeRate bfr ON bfr.BrokerFeeId = bf.BrokerFeeId
           WHERE bf.ClassCode = 'CAR'
           ORDER BY bf.StartDate, bfs.SortOrder`,
      ),
    ]);

    const pricesByKey = new Map<
      string,
      PricesFile["prices"][number] & { legacyVersionNumber: number }
    >();
    for (const row of priceRows.recordset) {
      const version = Number(row.VersionNumber);
      const dateStart = dateOnly(row.DateApplied);
      const key = `${version}|${dateStart}`;
      let header = pricesByKey.get(key);
      if (!header) {
        header = {
          priceId: 0, // assigned after sort
          dateStart,
          published: false,
          bands: [],
          legacyVersionNumber: version,
        };
        pricesByKey.set(key, header);
      }
      const upperRaw = row.UpperTurnover;
      const upperTO =
        upperRaw == null || Number(upperRaw) === 0 ? null : num(upperRaw);
      const bandKey = `${Number(row.CoverType)}|${num(row.LowerTurnover)}`;
      if (
        header.bands.some((b) => `${b.coverTypeId}|${b.lowerTO}` === bandKey)
      ) {
        continue;
      }
      header.bands.push({
        coverTypeId: Number(row.CoverType),
        lowerTO: num(row.LowerTurnover),
        upperTO,
        cwRate: num(row.CWRate),
        cwMinPrem: num(row.CWMinPrem),
        tenMilRate: num(row.TenMilLiability),
        tenMilMinPrem: num(row.TenMilMinPrem),
        twentyMilRate: num(row.TwentyMilLiability),
        twentyMilMinPrem: num(row.TwentyMilMinPrem),
      });
    }

    const pricesSorted = [...pricesByKey.values()].sort((a, b) => {
      const byDate = a.dateStart.localeCompare(b.dateStart);
      if (byDate !== 0) return byDate;
      return a.legacyVersionNumber - b.legacyVersionNumber;
    });
    const prices: PricesFile["prices"] = pricesSorted.map((header, index) => {
      const { legacyVersionNumber: _legacy, ...rest } = header;
      return {
        ...rest,
        priceId: index + 1,
      };
    });

    const stampByVersion = new Map<number, PricesFile["stampDuty"][number]>();
    for (const row of stampRows.recordset) {
      const version = Number(row.VersionNumber);
      let header = stampByVersion.get(version);
      if (!header) {
        header = {
          priceStampDutyId: version,
          dateStart: dateOnly(row.DateApplied),
          published: false,
          rates: [],
        };
        stampByVersion.set(version, header);
      }
      const stateCode = String(row.State ?? "")
        .trim()
        .toUpperCase();
      if (!stateCode) continue;
      const section =
        row.Section == null || row.Section === "" ? null : Number(row.Section);
      // App stores one rate per state — prefer section-null, else section 1.
      const existing = header.rates.find((r) => r.stateCode === stateCode);
      if (!existing) {
        header.rates.push({
          stateCode,
          rate: num(row.Rate),
          section,
        });
        continue;
      }
      const existingSection = existing.section ?? null;
      const preferNew =
        (existingSection != null && section == null) ||
        (existingSection != null &&
          section != null &&
          section < existingSection);
      if (preferNew) {
        existing.rate = num(row.Rate);
        existing.section = section;
      }
    }

    const eslByVersion = new Map<number, PricesFile["esl"][number]>();
    for (const row of eslRows.recordset) {
      const version = Number(row.VersionNumber);
      let header = eslByVersion.get(version);
      if (!header) {
        header = {
          priceEslId: version,
          dateStart: dateOnly(row.DateApplied),
          published: false,
          rates: [],
        };
        eslByVersion.set(version, header);
      }
      const stateCode = String(row.State ?? "")
        .trim()
        .toUpperCase();
      if (!stateCode) continue;
      header.rates.push({
        stateCode,
        constructionRate: num(row.ConstructionRate),
        plantRate: num(row.PlantRate),
      });
    }

    const plant: PricesFile["plant"] = plantRows.recordset.map((row) => ({
      pricePlantId: Number(row.VersionNumber),
      dateStart: dateOnly(row.DateApplied),
      published: false,
      rate: num(row.Rate),
      plantMinValue: num(row.PlantMinValue),
      plantMaxValue: num(row.PlantMaxValue),
    }));

    const postcodesByRateId = new Map<
      number,
      Array<{ postcode: string; stateCode: string }>
    >();
    for (const row of terrorPostcodeRows.recordset) {
      const rateId = Number(row.CAR_TerrorismRateId);
      const list = postcodesByRateId.get(rateId) ?? [];
      list.push({
        postcode: String(row.Postcode ?? "").trim(),
        stateCode: String(row.State ?? "")
          .trim()
          .toUpperCase(),
      });
      postcodesByRateId.set(rateId, list);
    }

    const terrorByDate = new Map<string, PricesFile["terror"][number]>();
    let terrorSeq = 0;
    for (const row of terrorRateRows.recordset) {
      const dateStart = dateOnly(row.StartDate);
      let header = terrorByDate.get(dateStart);
      if (!header) {
        terrorSeq += 1;
        header = {
          priceTerrorismId: terrorSeq,
          dateStart,
          published: false,
          tiers: [],
        };
        terrorByDate.set(dateStart, header);
      }
      const rateId = Number(row.CAR_TerrorismRateId);
      header.tiers.push({
        tier: String(row.Tier ?? "").trim(),
        rate: num(row.Rate),
        postcodes: (postcodesByRateId.get(rateId) ?? []).filter(
          (p) => p.postcode,
        ),
      });
    }

    const feesByDate = new Map<string, PricesFile["brokerFees"][number]>();
    for (const row of brokerRows.recordset) {
      const dateStart = dateOnly(row.StartDate);
      let header = feesByDate.get(dateStart);
      if (!header) {
        header = { dateStart, published: false, lines: [] };
        feesByDate.set(dateStart, header);
      }
      const fee = num(row.Base);
      // GST component at 10% of ex-GST fee (legacy Base is ex-GST).
      const feeGst = Math.round(fee * 0.1 * 100) / 100;
      header.lines.push({
        sortOrder: Number(row.SortOrder) || header.lines.length + 1,
        name: String(row.Name ?? "").trim(),
        fee,
        feeGst,
      });
    }

    const payload: PricesFile = {
      meta: {
        source:
          "mssql:CAR_PriceFile+CAR_StampDuty+CAR_ESL+CAR_PlantRate+CAR_Terrorism*",
        exportedAt: new Date().toISOString(),
        database,
      },
      prices: markLatestPublished(prices),
      stampDuty: markLatestPublished([...stampByVersion.values()]).sort(
        (a, b) => a.priceStampDutyId - b.priceStampDutyId,
      ),
      esl: markLatestPublished([...eslByVersion.values()]).sort(
        (a, b) => a.priceEslId - b.priceEslId,
      ),
      terror: markLatestPublished([...terrorByDate.values()]).sort((a, b) =>
        a.dateStart.localeCompare(b.dateStart),
      ),
      plant: markLatestPublished(plant).sort(
        (a, b) => a.pricePlantId - b.pricePlantId,
      ),
      brokerFees: markLatestPublished([...feesByDate.values()]).sort((a, b) =>
        a.dateStart.localeCompare(b.dateStart),
      ),
    };

    return payload;
  } finally {
    await pool.close();
  }
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  console.log("Exporting prices from MSSQL…");
  const payload = await exportPricesFromMssql();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${out}\n` +
      `  prices=${payload.prices.length} stampDuty=${payload.stampDuty.length} ` +
      `esl=${payload.esl.length} terror=${payload.terror.length} ` +
      `plant=${payload.plant.length} brokerFees=${payload.brokerFees.length}`,
  );
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
