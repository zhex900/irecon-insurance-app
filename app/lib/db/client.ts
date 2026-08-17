import { AsyncLocalStorage } from "node:async_hooks";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "~/lib/db/schema";
import {
  DEV_QUERY_GATE_MAX,
  QueryGate,
  registerPoolResetHandler,
  WORKER_QUERY_GATE_MAX,
  wrapPostgresWithGate,
} from "~/lib/db/query-gate";

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

type DbStore = {
  /** Gated client passed to Drizzle. */
  sql: Sql;
  /** Underlying pool — closed after each Worker request. */
  baseSql: Sql;
  db: Db;
  gate: QueryGate;
};

const dbContext = new AsyncLocalStorage<DbStore>();

const globalForDb = globalThis as unknown as {
  __ireconBaseSql?: Sql;
  __ireconBaseSqlUrl?: string;
  __ireconGatedSql?: Sql;
  __ireconGatedSqlUrl?: string;
  __ireconDb?: Db;
  __ireconGate?: QueryGate;
};

function queryGateLimit() {
  return isCloudflareWorker() ? WORKER_QUERY_GATE_MAX : DEV_QUERY_GATE_MAX;
}

function workerPoolMax() {
  return 5;
}

function createSql(url: string) {
  return postgres(url, {
    max: isCloudflareWorker() ? workerPoolMax() : 10,
    prepare: false,
    idle_timeout: isCloudflareWorker() ? 20 : 0,
    max_lifetime: isCloudflareWorker() ? 60 : 0,
    connect_timeout: 30,
  });
}

/** Reset dev/global fallback pool (not used for Worker request-scoped pools). */
export function resetSharedDbPool() {
  if (globalForDb.__ireconBaseSql) {
    void globalForDb.__ireconBaseSql.end({ timeout: 0 }).catch(() => {});
  }
  globalForDb.__ireconBaseSql = undefined;
  globalForDb.__ireconBaseSqlUrl = undefined;
  globalForDb.__ireconGatedSql = undefined;
  globalForDb.__ireconGatedSqlUrl = undefined;
  globalForDb.__ireconDb = undefined;
}

function getDevBaseSql(url = getDatabaseUrl()): Sql {
  if (globalForDb.__ireconBaseSql && globalForDb.__ireconBaseSqlUrl !== url) {
    resetSharedDbPool();
  }
  if (!globalForDb.__ireconBaseSql) {
    globalForDb.__ireconBaseSql = createSql(url);
    globalForDb.__ireconBaseSqlUrl = url;
  }
  return globalForDb.__ireconBaseSql;
}

function createGatedSql(baseSql: Sql, gate: QueryGate): Sql {
  return wrapPostgresWithGate(baseSql, gate);
}

function getOrCreateGlobalGate() {
  if (!globalForDb.__ireconGate) {
    globalForDb.__ireconGate = new QueryGate(queryGateLimit());
  }
  return globalForDb.__ireconGate;
}

function getGlobalGatedSql(url = getDatabaseUrl()): Sql {
  if (!globalForDb.__ireconGatedSql || globalForDb.__ireconGatedSqlUrl !== url) {
    globalForDb.__ireconGatedSql = createGatedSql(
      getDevBaseSql(url),
      getOrCreateGlobalGate(),
    );
    globalForDb.__ireconGatedSqlUrl = url;
    globalForDb.__ireconDb = undefined;
  }
  return globalForDb.__ireconGatedSql;
}

function createStore(url = getDatabaseUrl()): DbStore {
  const gate = new QueryGate(queryGateLimit());
  const baseSql = createSql(url);
  const sql = createGatedSql(baseSql, gate);
  const db = drizzle(sql, { schema });
  return { sql, db, gate, baseSql };
}

registerPoolResetHandler(resetSharedDbPool);

/**
 * Run `fn` with a request-scoped DB client (Cloudflare Workers).
 * Each request gets its own postgres pool — Workers forbid sharing sockets
 * across requests ("Cannot perform I/O on behalf of a different request").
 */
export async function withRequestDb<T>(
  fn: () => Promise<T>,
  url = getDatabaseUrl(),
): Promise<T> {
  const store = createStore(url);
  try {
    return await dbContext.run(store, fn);
  } finally {
    void store.baseSql.end({ timeout: 5 }).catch(() => {});
  }
}

function getSql() {
  const scoped = dbContext.getStore();
  if (scoped) return scoped.sql;

  return getGlobalGatedSql();
}

export function getDb() {
  const scoped = dbContext.getStore();
  if (scoped) {
    return scoped.db;
  }

  const url = getDatabaseUrl();
  if (!globalForDb.__ireconDb || globalForDb.__ireconGatedSqlUrl !== url) {
    globalForDb.__ireconDb = drizzle(getGlobalGatedSql(url), { schema });
  }
  return globalForDb.__ireconDb;
}

export type { Db };
