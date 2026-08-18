import { AsyncLocalStorage } from "node:async_hooks";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  DEV_QUERY_GATE_MAX,
  QueryGate,
  registerPoolResetHandler,
  WORKER_POOL_MAX,
  WORKER_QUERY_GATE_MAX,
  wrapPostgresWithGate,
} from "~/lib/db/query-gate";
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
  return WORKER_POOL_MAX;
}

function createSql(url: string) {
  return postgres(url, {
    max: isCloudflareWorker() ? workerPoolMax() : 10,
    prepare: false,
    idle_timeout: isCloudflareWorker() ? 0 : 0,
    max_lifetime: isCloudflareWorker() ? 0 : 0,
    connect_timeout: 30,
  });
}

/** Reset dev/global fallback pool (not used for Worker request-scoped pools). */
export async function resetSharedDbPool() {
  if (globalForDb.__ireconGate) {
    await globalForDb.__ireconGate.drain();
  }
  if (globalForDb.__ireconBaseSql) {
    await globalForDb.__ireconBaseSql.end({ timeout: 2 }).catch(() => {});
  }
  globalForDb.__ireconBaseSql = undefined;
  globalForDb.__ireconBaseSqlUrl = undefined;
  globalForDb.__ireconGatedSql = undefined;
  globalForDb.__ireconGatedSqlUrl = undefined;
  globalForDb.__ireconDb = undefined;
}

function getDevBaseSql(url = getDatabaseUrl()): Sql {
  if (globalForDb.__ireconBaseSql && globalForDb.__ireconBaseSqlUrl !== url) {
    void resetSharedDbPool();
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

/** Drop the active pool (request-scoped on Workers, global in dev) before retry. */
export async function resetActiveDbPool() {
  const store = dbContext.getStore();
  if (store) {
    await store.gate.drain();
    await store.baseSql.end({ timeout: 2 }).catch(() => {});
    const baseSql = createSql(getDatabaseUrl());
    store.baseSql = baseSql;
    store.sql = createGatedSql(baseSql, store.gate);
    store.db = drizzle(store.sql, { schema });
    return;
  }
  await resetSharedDbPool();
}

registerPoolResetHandler(resetActiveDbPool);

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
