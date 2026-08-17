import type postgres from "postgres";

import { logger } from "~/lib/observability/logger.server";

/** In-flight query cap per request (Workers postgres pool max is 2). */
export const WORKER_QUERY_GATE_MAX = 4;
export const DEV_QUERY_GATE_MAX = 3;

const TRANSIENT_RETRY_ATTEMPTS = 1;
const TRANSIENT_RETRY_BASE_MS = 50;
const SLOW_QUEUE_WAIT_MS = 500;

let poolResetHandler: (() => void | Promise<void>) | undefined;

/** Called by `app/lib/db/client.ts` to drop stale shared pools before retry. */
export function registerPoolResetHandler(handler: () => void | Promise<void>) {
  poolResetHandler = handler;
}

export class QueryGate {
  private inFlight = 0;
  private readonly queue: Array<() => void> = [];
  private readonly drainWaiters: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {}

  /** Wait until no queries are in-flight or queued (safe before pool reset). */
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
        return await this.runWithTransientRetry(fn);
      } finally {
        this.release();
      }
    });
  }

  private runWithTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
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
        await poolResetHandler?.();
        await sleep(TRANSIENT_RETRY_BASE_MS * (tryIndex + 1));
        return attempt(tryIndex + 1);
      }
    };
    return attempt(0);
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

export function isTransientDbError(error: unknown): boolean {
  if (error == null) return false;

  if (typeof error === "object" && "cause" in error && error.cause != null) {
    if (isTransientDbError(error.cause)) return true;
  }

  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
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
    message.includes("connection refused") ||
    message.includes("after calling end on the pool") ||
    message.includes("socket hang up") ||
    message.includes("broken pipe") ||
    message.includes("timeout") ||
    message.includes("too many clients") ||
    message.includes("econnrefused")
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
 * Drizzle calls `client.unsafe(sql, params).values()` — the gate must wrap
 * the Query, not replace it with a bare Promise.
 */
function wrapPostgresQuery<T extends object>(gate: QueryGate, query: T): T {
  return new Proxy(query, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return (
          onFulfilled?: ((value: unknown) => unknown) | null,
          onRejected?: ((reason: unknown) => unknown) | null,
        ) =>
          gate.run(() =>
            Promise.resolve(target as PromiseLike<unknown>).then(
              onFulfilled,
              onRejected,
            ),
          );
      }

      if (prop === "catch") {
        return (onRejected?: ((reason: unknown) => unknown) | null) =>
          gate.run(() =>
            Promise.resolve(target as PromiseLike<unknown>).catch(onRejected),
          );
      }

      if (prop === "finally") {
        return (onFinally?: (() => void) | null) =>
          gate.run(() =>
            Promise.resolve(target as PromiseLike<unknown>).finally(onFinally),
          );
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        const result: unknown = value.apply(target, args);
        if (result === target) return receiver;
        if (result != null && typeof result === "object") {
          return wrapPostgresQuery(gate, result as object);
        }
        return result;
      };
    },
  }) as T;
}

/** Limit concurrent postgres queries for one request-scoped pool. */
export function wrapPostgresWithGate(sql: Sql, gate: QueryGate): Sql {
  return new Proxy(sql, {
    apply(_target, _thisArg, argArray) {
      const query = Reflect.apply(sql, undefined, argArray);
      return wrapPostgresQuery(gate, query as object);
    },
    get(target, prop, receiver) {
      if (prop === "unsafe") {
        return (...args: unknown[]) => {
          const query = (target as Sql).unsafe(
            ...(args as Parameters<Sql["unsafe"]>),
          );
          return wrapPostgresQuery(gate, query as object);
        };
      }

      if (prop === "begin") {
        return (...args: unknown[]) => {
          const wrapTx = (
            tx: postgres.TransactionSql,
          ): postgres.TransactionSql =>
            wrapPostgresWithGate(
              tx as unknown as Sql,
              gate,
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
