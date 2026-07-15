import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbDir = join(root, "json-server");
mkdirSync(dbDir, { recursive: true });
const clients = JSON.parse(readFileSync(join(root, "app/data/clients.json"), "utf8"));
const quotes = JSON.parse(readFileSync(join(root, "app/data/quotes.json"), "utf8"));

const db = {
  clients: clients.map((client) => ({
    id: client.clientId,
    ...client,
  })),
  quotes: quotes.map((quote) => ({
    id: quote.policyId,
    insurerCode: quote.insurerCode ?? "ATC",
    isDraft: quote.isDraft ?? !quote.car?.premium,
    ...quote,
  })),
};

writeFileSync(join(dbDir, "db.json"), `${JSON.stringify(db, null, 2)}\n`);
console.log("Wrote json-server/db.json");
