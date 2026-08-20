import type postgres from "postgres";

import { logger } from "~/lib/observability/logger.server";

/** Worker postgres pool size (request-scoped; Hyperdrive pools origins). */
export const WORKER_POOL_MAX = 1;
/** Dev-only cap on parallel in-flight queries (local postgres pool allows more). */
export const DEV_QUERY_GATE_MAX = 3;

/** Three attempts with backoff before surfacing a transient Hyperdrive/Postgres error. */
const TRANSIENT_RETRY_ATTEMPTS = 3;
const TRANSIENT_RETRY_DELAYS_MS = [50, 150] as const;
const SLOW_QUEUE_WAIT_MS = 500;

let poolResetHandler: (() => void | Promise<void>) | undefined;

/** Called by `app/lib/db/client.ts` to drop stale pools before retry. */
export function registerPoolResetHandler(handler: () => void | Promise<void>) {
  poolResetHandler = handler;
}

/** Runs postgres queries with optional dev concurrency limiting + transient retry. */
export type DbExecutor = {
  run<T>(fn: () => Promise<T>): Promise<T>;
  drain(): Promise<void>;
};

/** Tracks in-flight wrapped queries so pool reset can wait for them (Workers + dev). */
class InFlightTracker {
  private inFlight = 0;
  private readonly drainWaiters: Array<() => void> = [];

  async track<T>(fn: () => Promise<T>): Promise<T> {
    this.inFlight += 1;
    try {
      return await fn();
    } finally {
      this.inFlight = Math.max(0, this.inFlight - 1);
      this.notifyDrained();
    }
  }

  drain(): Promise<void> {
    if (this.inFlight === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.drainWaiters.push(resolve);
    });
  }

  private notifyDrained() {
    if (this.inFlight > 0) return;
    const waiters = this.drainWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}

function createRetryExecutor(tracker: InFlightTracker): DbExecutor {
  return {
    run: (fn) => tracker.track(() => runWithTransientRetry(fn)),
    drain: () => tracker.drain(),
  };
}

/** Dev-only: limit parallel queries; Workers rely on postgres `max: 1` instead. */
export class QueryConcurrencyGate {
  private inFlight = 0;
  private readonly queue: Array<() => void> = [];
  private readonly drainWaiters: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {}

  drain(): Promise<void> {
    if (this.inFlight === 0 && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.drainWaiters.push(resolve);
    });
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.acquire().then(async (waitMs) => {
      if (waitMs >= SLOW_QUEUE_WAIT_MS) {
        logger.warn("db.query_gate_slow", {
          waitMs,
          maxConcurrent: this.maxConcurrent,
          queued: this.queue.length,
        });
      }
      try {
        return await fn();
      } finally {
        this.release();
      }
    });
  }

  private acquire(): Promise<number> {
    const started = Date.now();
    if (this.inFlight < this.maxConcurrent) {
      this.inFlight += 1;
      return Promise.resolve(0);
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.inFlight += 1;
        resolve(Date.now() - started);
      });
    });
  }

  private release() {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const next = this.queue.shift();
    if (next) next();
    this.notifyDrained();
  }

  private notifyDrained() {
    if (this.inFlight > 0 || this.queue.length > 0) return;
    const waiters = this.drainWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}

export function createDbExecutor(limitConcurrency: boolean): DbExecutor {
  const tracker = new InFlightTracker();
  if (!limitConcurrency) {
    return createRetryExecutor(tracker);
  }

  const gate = new QueryConcurrencyGate(DEV_QUERY_GATE_MAX);
  return {
    run: (fn) => gate.run(() => tracker.track(() => runWithTransientRetry(fn))),
    drain: async () => {
      await gate.drain();
      await tracker.drain();
    },
  };
}

export async function runWithTransientRetry<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const attempt = async (tryIndex: number): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (
        tryIndex >= TRANSIENT_RETRY_ATTEMPTS - 1 ||
        !isTransientDbError(error)
      ) {
        throw error;
      }
      logger.warn("db.transient_retry", {
        attempt: tryIndex + 1,
        maxAttempts: TRANSIENT_RETRY_ATTEMPTS,
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
      await poolResetHandler?.();
      const delayMs =
        TRANSIENT_RETRY_DELAYS_MS[tryIndex] ??
        TRANSIENT_RETRY_DELAYS_MS.at(-1) ??
        150;
      await sleep(delayMs);
      return attempt(tryIndex + 1);
    }
  };
  return attempt(0);
}

export function isTransientDbError(error: unknown): boolean {
  if (error == null) return false;

  if (typeof error === "object" && "cause" in error && error.cause != null) {
    if (isTransientDbError(error.cause)) return true;
  }

  if (!(error instanceof Error)) return false;

  const rawMessage = error.message.toLowerCase();
  const message = rawMessage.replaceAll("_", " ");
  const code = (error as { code?: string }).code?.toUpperCase();
  if (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "53300" ||
    code === "57P01" ||
    code === "08006"
  ) {
    return true;
  }

  return (
    message.includes("connection terminated") ||
    message.includes("connection reset") ||
    message.includes("connection closed") ||
    rawMessage.includes("connection_closed") ||
    message.includes("idle connection closed by hyperdrive") ||
    message.includes("connection lost") ||
    message.includes("connection refused") ||
    message.includes("after calling end on the pool") ||
    message.includes("socket hang up") ||
    message.includes("broken pipe") ||
    message.includes("timeout") ||
    message.includes("too many clients") ||
    message.includes("econnrefused") ||
    message.includes("network connection lost")
  );
}

/** Flatten Drizzle/postgres error chains for logs. */
export function formatDbErrorChain(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(" | cause: ");
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

type Sql = ReturnType<typeof postgres>;

/**
 * postgres.js returns Query objects (thenables with `.values()`, etc.).
 * Drizzle calls `client.unsafe(sql, params).values()` — wrap the Query,
 * not a bare Promise. `createQuery` runs again on each retry attempt.
 */
function wrapPostgresQuery<T extends object>(
  executor: DbExecutor,
  createQuery: () => T,
): T {
  const runQuery = () =>
    executor.run(async () => {
      const query = createQuery();
      return await (query as PromiseLike<unknown>);
    });

  return new Proxy({} as T, {
    get(_target, prop) {
      if (prop === "then") {
        return (
          onFulfilled?: ((value: unknown) => unknown) | null,
          onRejected?: ((reason: unknown) => unknown) | null,
        ) => runQuery().then(onFulfilled, onRejected);
      }

      if (prop === "catch") {
        return (onRejected?: ((reason: unknown) => unknown) | null) =>
          runQuery().catch(onRejected);
      }

      if (prop === "finally") {
        return (onFinally?: (() => void) | null) =>
          runQuery().finally(onFinally);
      }

      const sample = createQuery();
      const value = Reflect.get(sample, prop, sample);
      if (typeof value !== "function") return value;

      return (...args: unknown[]) =>
        wrapPostgresQuery(executor, () => {
          const query = createQuery();
          const method = Reflect.get(query, prop, query);
          if (typeof method !== "function") {
            throw new Error(`postgres query.${String(prop)} is not a function`);
          }
          return Reflect.apply(method, query, args) as T;
        });
    },
  }) as T;
}

/** Retry all postgres queries; optionally limit concurrency (dev only). */
export function wrapPostgresSql(sql: Sql, executor: DbExecutor): Sql {
  return new Proxy(sql, {
    apply(_target, _thisArg, argArray) {
      return wrapPostgresQuery(executor, () =>
        Reflect.apply(sql, undefined, argArray),
      );
    },
    get(target, prop, receiver) {
      if (prop === "unsafe") {
        return (...args: unknown[]) =>
          wrapPostgresQuery(executor, () =>
            (target as Sql).unsafe(...(args as Parameters<Sql["unsafe"]>)),
          );
      }

      if (prop === "begin") {
        return (...args: unknown[]) => {
          const wrapTx = (
            tx: postgres.TransactionSql,
          ): postgres.TransactionSql =>
            wrapPostgresSql(
              tx as unknown as Sql,
              executor,
            ) as unknown as postgres.TransactionSql;
          if (typeof args[0] === "function") {
            const cb = args[0] as (tx: postgres.TransactionSql) => unknown;
            return target.begin((tx) => cb(wrapTx(tx)));
          }
          const name = args[0] as string;
          const cb = args[1] as (tx: postgres.TransactionSql) => unknown;
          return target.begin(name, (tx) => cb(wrapTx(tx)));
        };
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  }) as Sql;
}
