import { describe, expect, it } from "vitest";

import {
  createDbExecutor,
  isTransientDbError,
  QueryConcurrencyGate,
  registerPoolResetHandler,
  runWithTransientRetry,
  wrapPostgresSql,
} from "~/lib/db/query-gate";

describe("QueryConcurrencyGate", () => {
  it("limits concurrent runs", async () => {
    const gate = new QueryConcurrencyGate(2);
    let inFlight = 0;
    let maxInFlight = 0;

    const task = () =>
      gate.run(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
      });

    await Promise.all([task(), task(), task(), task()]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("queues excess work in order", async () => {
    const gate = new QueryConcurrencyGate(1);
    const order: number[] = [];

    await Promise.all([
      gate.run(async () => {
        order.push(1);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }),
      gate.run(async () => {
        order.push(2);
      }),
    ]);

    expect(order).toEqual([1, 2]);
  });

  it("drain waits until in-flight and queued work finishes", async () => {
    const gate = new QueryConcurrencyGate(1);
    let released = false;

    const running = gate.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      released = true;
    });
    const queued = gate.run(async () => {});

    const drained = gate.drain();
    let drainResolved = false;
    void drained.then(() => {
      drainResolved = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(drainResolved).toBe(false);

    await Promise.all([running, queued, drained]);
    expect(released).toBe(true);
    expect(drainResolved).toBe(true);
  });
});

describe("runWithTransientRetry", () => {
  it("retries transient errors up to three times", async () => {
    registerPoolResetHandler(async () => {});
    let attempts = 0;

    await runWithTransientRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("Idle connection closed by Hyperdrive.");
      }
      return "ok";
    });

    expect(attempts).toBe(3);
  });
});

describe("isTransientDbError", () => {
  it("detects connection errors in postgres.js messages", () => {
    expect(
      isTransientDbError(new Error("Failed query: connection terminated")),
    ).toBe(true);
  });

  it("detects hyperdrive connection_closed errors", () => {
    expect(
      isTransientDbError(
        new Error(
          "Failed query: select 1 | cause: write CONNECTION_CLOSED host.hyperdrive.local:5432",
        ),
      ),
    ).toBe(true);
  });

  it("detects idle hyperdrive disconnects", () => {
    expect(
      isTransientDbError(new Error("Idle connection closed by Hyperdrive.")),
    ).toBe(true);
    expect(
      isTransientDbError(
        new Error("write CONNECTION_CLOSED host.hyperdrive.local:5432"),
      ),
    ).toBe(true);
  });

  it("detects cloudflare network connection lost in error cause", () => {
    const inner = new Error("Network connection lost.");
    const wrapped = new Error(
      'Failed query: select count(*)::int from "policy" where "policy"."client_id" = $1',
    );
    wrapped.cause = inner;
    expect(isTransientDbError(wrapped)).toBe(true);
  });

  it("does not treat generic failed query as transient", () => {
    expect(isTransientDbError(new Error("Failed query: select 1"))).toBe(false);
  });

  it("unwraps drizzle error causes", () => {
    const inner = new Error("connection terminated");
    const wrapped = new Error("Failed query: select 1");
    wrapped.cause = inner;
    expect(isTransientDbError(wrapped)).toBe(true);
  });

  it("ignores validation errors", () => {
    expect(isTransientDbError(new Error("Invalid policy id."))).toBe(false);
  });
});

function mockQuery(run: () => Promise<unknown>) {
  const query = {
    values() {
      return this;
    },
    then(
      onFulfilled?: ((value: unknown) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) {
      return run().then(onFulfilled, onRejected);
    },
  };
  return query;
}

describe("wrapPostgresSql", () => {
  it("limits concurrent queries in dev executor", async () => {
    const executor = createDbExecutor(true);
    let concurrent = 0;
    let maxConcurrent = 0;

    const sql = wrapPostgresSql(
      Object.assign(
        () =>
          mockQuery(() => {
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            return Promise.resolve([]).finally(() => {
              concurrent -= 1;
            });
          }),
        {
          unsafe: () => {
            throw new Error("unsafe not used");
          },
        },
      ) as unknown as ReturnType<typeof import("postgres")>,
      executor,
    );

    await Promise.all([
      sql`select 1`,
      sql`select 2`,
      sql`select 3`,
      sql`select 4`,
    ]);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it("gates unsafe queries when awaited", async () => {
    const executor = createDbExecutor(true);
    let concurrent = 0;
    let maxConcurrent = 0;

    const base = Object.assign(
      (() => {
        throw new Error("tagged template not used in test");
      }) as unknown as ReturnType<typeof import("postgres")>,
      {
        unsafe: () =>
          mockQuery(() => {
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            return Promise.resolve([{ ok: true }]).finally(() => {
              concurrent -= 1;
            });
          }),
      },
    );

    const sql = wrapPostgresSql(base, executor);
    await Promise.all([
      sql.unsafe("select 1").values(),
      sql.unsafe("select 2").values(),
    ]);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it("re-runs the postgres query factory on transient retry", async () => {
    registerPoolResetHandler(async () => {});
    const executor = createDbExecutor(false);
    let factoryCalls = 0;
    let runAttempts = 0;

    const sql = wrapPostgresSql(
      Object.assign(
        () => {
          factoryCalls += 1;
          return mockQuery(() => {
            runAttempts += 1;
            if (runAttempts === 1) {
              return Promise.reject(
                new Error("Idle connection closed by Hyperdrive."),
              );
            }
            return Promise.resolve([{ ok: true }]);
          });
        },
        {
          unsafe: () => {
            throw new Error("unsafe not used");
          },
        },
      ) as unknown as ReturnType<typeof import("postgres")>,
      executor,
    );

    const [row] = await sql`select 1`;
    expect(row).toEqual({ ok: true });
    expect(factoryCalls).toBe(2);
    expect(runAttempts).toBe(2);
  });
});
