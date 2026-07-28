import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedPrices } from "./seed-prices";

async function main() {
  await seedPrices();
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
