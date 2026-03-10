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
});
