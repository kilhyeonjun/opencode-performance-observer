import { describe, expect, it } from "vitest";
import { ThroughputTracker } from "./tracker.js";

describe("ThroughputTracker", () => {
  it("calculates instant TPS inside rolling window", () => {
    const tracker = new ThroughputTracker(1000, 0);
    tracker.record(20, 100);
    tracker.record(20, 300);

    expect(tracker.instantTps(1000)).toBe(40);
  });

  it("drops samples outside rolling window", () => {
    const tracker = new ThroughputTracker(500, 0);
    tracker.record(10, 100);
    tracker.record(10, 200);

    expect(tracker.instantTps(700)).toBe(20);
    expect(tracker.instantTps(800)).toBe(0);
  });

  it("calculates average TPS over elapsed time", () => {
    const tracker = new ThroughputTracker(1000, 0);
    tracker.record(100, 100);

    expect(tracker.averageTps(1000)).toBe(100);
  });

  it("averageTps stays correct after prune removes old samples", () => {
    const tracker = new ThroughputTracker(500, 0);
    tracker.record(50, 100);
    tracker.record(50, 200);

    expect(tracker.averageTps(2000)).toBe(50);

    expect(tracker.instantTps(2000)).toBe(0);

    expect(tracker.totalTokens()).toBe(100);
  });

  it("totalTokens accumulates across pruned windows", () => {
    const tracker = new ThroughputTracker(100, 0);
    tracker.record(10, 50);
    tracker.record(20, 150);
    tracker.record(30, 350);

    expect(tracker.totalTokens()).toBe(60);
  });
});
