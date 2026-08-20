import { AsyncLocalStorage } from "node:async_hooks";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  createDbExecutor,
  type DbExecutor,
  registerPoolResetHandler,
  WORKER_POOL_MAX,
  wrapPostgresSql,
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
  sql: Sql;
  baseSql: Sql;
  db: Db;
  executor: DbExecutor;
};

const dbContext = new AsyncLocalStorage<DbStore>();

const globalForDb = globalThis as unknown as {
  __ireconBaseSql?: Sql;
  __ireconBaseSqlUrl?: string;
  __ireconWrappedSql?: Sql;
  __ireconWrappedSqlUrl?: string;
  __ireconDb?: Db;
  __ireconExecutor?: DbExecutor;
};

function createSql(url: string) {
  return postgres(url, {
    max: isCloudflareWorker() ? WORKER_POOL_MAX : 10,
    prepare: false,
    idle_timeout: 0,
    max_lifetime: 0,
    connect_timeout: 30,
  });
}

function createExecutor() {
  return createDbExecutor(!isCloudflareWorker());
}

/** Reset dev/global fallback pool (not used for Worker request-scoped pools). */
export async function resetSharedDbPool() {
  if (globalForDb.__ireconExecutor) {
    await globalForDb.__ireconExecutor.drain();
  }
  if (globalForDb.__ireconBaseSql) {
    await globalForDb.__ireconBaseSql.end({ timeout: 2 }).catch(() => {});
  }
  globalForDb.__ireconBaseSql = undefined;
  globalForDb.__ireconBaseSqlUrl = undefined;
  globalForDb.__ireconWrappedSql = undefined;
  globalForDb.__ireconWrappedSqlUrl = undefined;
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

function wrapSql(baseSql: Sql, executor: DbExecutor): Sql {
  return wrapPostgresSql(baseSql, executor);
}

function getOrCreateGlobalExecutor() {
  if (!globalForDb.__ireconExecutor) {
    globalForDb.__ireconExecutor = createExecutor();
  }
  return globalForDb.__ireconExecutor;
}

function getGlobalWrappedSql(url = getDatabaseUrl()): Sql {
  if (
    !globalForDb.__ireconWrappedSql ||
    globalForDb.__ireconWrappedSqlUrl !== url
  ) {
    globalForDb.__ireconWrappedSql = wrapSql(
      getDevBaseSql(url),
      getOrCreateGlobalExecutor(),
    );
    globalForDb.__ireconWrappedSqlUrl = url;
    globalForDb.__ireconDb = undefined;
  }
  return globalForDb.__ireconWrappedSql;
}

function createStore(url = getDatabaseUrl()): DbStore {
  const executor = createExecutor();
  const baseSql = createSql(url);
  const sql = wrapSql(baseSql, executor);
  const db = drizzle(sql, { schema });
  return { sql, db, executor, baseSql };
}

/** Drop the active pool before retry (request-scoped on Workers, global in dev). */
export async function resetActiveDbPool() {
  const store = dbContext.getStore();
  if (store) {
    await store.executor.drain();
    await store.baseSql.end({ timeout: 2 }).catch(() => {});
    const baseSql = createSql(getDatabaseUrl());
    store.baseSql = baseSql;
    store.sql = wrapSql(baseSql, store.executor);
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
  if (!globalForDb.__ireconDb || globalForDb.__ireconWrappedSqlUrl !== url) {
    globalForDb.__ireconDb = drizzle(getGlobalWrappedSql(url), { schema });
  }
  return globalForDb.__ireconDb;
}

export type { Db };
