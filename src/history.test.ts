import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { JsonlHistory } from "./history.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

const baseRecord = {
  sessionID: "s1",
  messageID: "m1",
  modelID: "claude-sonnet-4-20250514",
  providerID: "anthropic",
  startedAt: 1,
  endedAt: 10,
  inputTokens: 500,
  outputTokens: 10,
  reasoningTokens: 2,
  cacheReadTokens: 100,
  cacheWriteTokens: 50,
  totalTokens: 12,
  cost: 0.003,
  durationMs: 9,
  averageTps: 1333,
};

describe("JsonlHistory", () => {
  it("appends and reads back recent records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "perf-observer-"));
    tempDirs.push(dir);

    const filePath = join(dir, "history.jsonl");
    const history = new JsonlHistory(filePath);

    await history.append({ ...baseRecord, messageID: "m1" });
    await history.append({ ...baseRecord, messageID: "m2", cost: 0.007 });

    const recent = await history.readRecent(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].messageID).toBe("m2");
    expect(recent[0].cost).toBe(0.007);
    expect(recent[0].modelID).toBe("claude-sonnet-4-20250514");
  });

  it("reads back all new fields correctly", async () => {
    const dir = await mkdtemp(join(tmpdir(), "perf-observer-"));
    tempDirs.push(dir);

    const filePath = join(dir, "history.jsonl");
    const history = new JsonlHistory(filePath);

    await history.append(baseRecord);

    const recent = await history.readRecent(5);
    expect(recent).toHaveLength(1);

    const r = recent[0];
    expect(r.inputTokens).toBe(500);
    expect(r.cacheReadTokens).toBe(100);
    expect(r.cacheWriteTokens).toBe(50);
    expect(r.providerID).toBe("anthropic");
    expect(r.cost).toBe(0.003);
  });
});
