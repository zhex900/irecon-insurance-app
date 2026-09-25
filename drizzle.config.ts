import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./app/lib/db/schema.ts", "./app/lib/db/price-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
});
