import { describe, expect, it, vi } from "vitest";
import { SessionStore } from "./session-store.js";

describe("SessionStore", () => {
  it("records deltas and emits live formatted line", () => {
    const store = new SessionStore(undefined, 1000);
    store.beginTurn("s1", "m1", 0);
    store.recordDelta("s1", "m1", 20, 100, "text");

    const line = store.formatLiveLine("s1", 1000);
    expect(line).toContain("TPS");
    expect(line).toContain("avg");
  });

  it("finishes a turn and writes history", async () => {
    const append = vi.fn(async () => undefined);
    const store = new SessionStore({ append }, 1000);

    store.beginTurn("s1", "m1", 0);
    store.recordDelta("s1", "m1", 12, 100, "text");

    const record = await store.finishTurn("s1", "m1", 1000, {
      output: 30,
      reasoning: 10,
    });

    expect(record?.totalTokens).toBe(40);
    expect(append).toHaveBeenCalledTimes(1);
  });

  it("beginTurn is idempotent — does not reset existing turn", () => {
    const store = new SessionStore(undefined, 1000);
    store.beginTurn("s1", "m1", 0);
    store.recordDelta("s1", "m1", 20, 100, "text");

    store.beginTurn("s1", "m1", 0);

    const line = store.formatLiveLine("s1", 200);
    expect(line).toContain("TPS");
  });

  it("beginTurn idempotency preserves firstTokenAt for latency", async () => {
    const append = vi.fn(async () => undefined);
    const store = new SessionStore({ append }, 2000);

    store.beginTurn("s1", "m1", 1000);
    store.recordDelta("s1", "m1", 10, 1200, "text");

    store.beginTurn("s1", "m1", 1000);

    const record = await store.finishTurn("s1", "m1", 2000, {
      output: 50,
      reasoning: 0,
    });

    expect(record).toBeDefined();
    expect(record!.latencyMs).toBe(200);
  });

  it("latency is calculated correctly from firstTokenAt", async () => {
    const append = vi.fn(async () => undefined);
    const store = new SessionStore({ append }, 2000);

    store.beginTurn("s1", "m1", 1000);
    store.recordDelta("s1", "m1", 5, 1500, "text");
    store.recordDelta("s1", "m1", 10, 1600, "text");

    const record = await store.finishTurn("s1", "m1", 3000, {
      output: 100,
      reasoning: 0,
    });

    expect(record).toBeDefined();
    expect(record!.latencyMs).toBe(500);
    expect(record!.totalTokens).toBe(100);
  });
});
