import { describe, expect, it, vi } from "vitest";
import { SessionStore } from "./session-store.js";

const baseMeta = {
  modelID: "claude-sonnet-4-20250514",
  providerID: "anthropic",
  cost: 0.05,
  input: 1000,
  output: 30,
  reasoning: 10,
  cacheRead: 500,
  cacheWrite: 200,
};

describe("SessionStore", () => {
  it("records deltas and emits live formatted line", () => {
    const store = new SessionStore(undefined, 1000);
    store.beginTurn("s1", "m1", 0);
    store.recordDelta("s1", "m1", 20, 100, "text");

    const line = store.formatLiveLine("s1", 1000);
    expect(line).toContain("TPS");
    expect(line).toContain("avg");
  });

  it("finishes a turn and writes history with full metadata", async () => {
    const append = vi.fn(async () => undefined);
    const store = new SessionStore({ append }, 1000);

    store.beginTurn("s1", "m1", 0);
    store.recordDelta("s1", "m1", 12, 100, "text");

    const record = await store.finishTurn("s1", "m1", 1000, baseMeta);

    expect(record?.totalTokens).toBe(40);
    expect(record?.modelID).toBe("claude-sonnet-4-20250514");
    expect(record?.providerID).toBe("anthropic");
    expect(record?.cost).toBe(0.05);
    expect(record?.inputTokens).toBe(1000);
    expect(record?.cacheReadTokens).toBe(500);
    expect(record?.cacheWriteTokens).toBe(200);
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
      ...baseMeta,
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
      ...baseMeta,
      output: 100,
      reasoning: 0,
    });

    expect(record).toBeDefined();
    expect(record!.latencyMs).toBe(500);
    expect(record!.totalTokens).toBe(100);
  });

  it("cost is stored correctly and accumulates across turns", async () => {
    const append = vi.fn(async () => undefined);
    const store = new SessionStore({ append }, 2000);

    store.beginTurn("s1", "m1", 0);
    store.recordDelta("s1", "m1", 5, 100, "text");
    const r1 = await store.finishTurn("s1", "m1", 1000, {
      ...baseMeta,
      cost: 0.012,
    });

    store.beginTurn("s1", "m2", 1000);
    store.recordDelta("s1", "m2", 10, 1100, "text");
    const r2 = await store.finishTurn("s1", "m2", 2000, {
      ...baseMeta,
      cost: 0.025,
    });

    expect(r1?.cost).toBe(0.012);
    expect(r2?.cost).toBe(0.025);
  });

  it("returns undefined for unknown session or message", async () => {
    const store = new SessionStore(undefined, 1000);

    const r1 = await store.finishTurn("unknown", "m1", 1000, baseMeta);
    expect(r1).toBeUndefined();

    store.beginTurn("s1", "m1", 0);
    const r2 = await store.finishTurn("s1", "unknown", 1000, baseMeta);
    expect(r2).toBeUndefined();
  });
});
