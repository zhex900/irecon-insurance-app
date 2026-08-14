import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "~/lib/db/schema";

const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || DEFAULT_URL;
}

function isCloudflareWorker() {
  return (
    typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !==
    "undefined"
  );
}

type Sql = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;

type DbStore = { sql: Sql; db: Db };

const dbContext = new AsyncLocalStorage<DbStore>();

const globalForDb = globalThis as unknown as {
  __ireconSql?: Sql;
  __ireconDb?: Db;
  __ireconDbUrl?: string;
};

function createSql(url: string) {
  return postgres(url, {
    // Hyperdrive docs: keep Worker pools small; prepared statements off.
    max: isCloudflareWorker() ? 5 : 10,
    prepare: false,
    idle_timeout: isCloudflareWorker() ? 20 : 0,
    max_lifetime: isCloudflareWorker() ? 60 : 0,
    connect_timeout: 30,
  });
}

function createStore(url = getDatabaseUrl()): DbStore {
  const sql = createSql(url);
  const db = drizzle(sql, { schema });
  return { sql, db };
}

/**
 * Run `fn` with a request-scoped DB client (Cloudflare Workers).
 * Avoids races from sharing/resetting a global pool across concurrent fetches.
 */
export async function withRequestDb<T>(
  fn: () => Promise<T>,
  url = getDatabaseUrl(),
): Promise<T> {
  const store = createStore(url);
  try {
    return await dbContext.run(store, fn);
  } finally {
    void store.sql.end({ timeout: 5 }).catch(() => {});
  }
}

function getSql() {
  const scoped = dbContext.getStore();
  if (scoped) return scoped.sql;

  const url = getDatabaseUrl();
  if (!globalForDb.__ireconSql || globalForDb.__ireconDbUrl !== url) {
    if (globalForDb.__ireconSql) {
      void globalForDb.__ireconSql.end({ timeout: 0 }).catch(() => {});
    }
    globalForDb.__ireconSql = createSql(url);
    globalForDb.__ireconDb = undefined;
    globalForDb.__ireconDbUrl = url;
  }
  return globalForDb.__ireconSql;
}

export function getDb() {
  const scoped = dbContext.getStore();
  if (scoped) {
    return scoped.db;
  }

  if (
    !globalForDb.__ireconDb ||
    globalForDb.__ireconDbUrl !== getDatabaseUrl()
  ) {
    globalForDb.__ireconDb = drizzle(getSql(), { schema });
  }
  return globalForDb.__ireconDb;
}

export type { Db };
