import { describe, expect, it } from "vitest";

import {
  isTransientDbError,
  QueryGate,
  wrapPostgresWithGate,
} from "~/lib/db/query-gate";

describe("QueryGate", () => {
  it("limits concurrent runs", async () => {
    const gate = new QueryGate(2);
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
    const gate = new QueryGate(1);
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

  it("retries transient errors once", async () => {
    const gate = new QueryGate(2);
    let attempts = 0;

    await gate.run(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("Failed query: connection terminated");
      }
      return "ok";
    });

    expect(attempts).toBe(2);
  });
});

describe("isTransientDbError", () => {
  it("detects connection errors in postgres.js messages", () => {
    expect(
      isTransientDbError(new Error("Failed query: connection terminated")),
    ).toBe(true);
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

describe("wrapPostgresWithGate", () => {
  it("gates tagged-template queries when awaited", async () => {
    const gate = new QueryGate(1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const sql = wrapPostgresWithGate(
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
      gate,
    );

    await Promise.all([sql`select 1`, sql`select 2`]);
    expect(maxConcurrent).toBe(1);
  });

  it("gates unsafe queries when awaited", async () => {
    const gate = new QueryGate(1);
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

    const sql = wrapPostgresWithGate(base, gate);
    await Promise.all([
      sql.unsafe("select 1").values(),
      sql.unsafe("select 2").values(),
    ]);
    expect(maxConcurrent).toBe(1);
  });
});
