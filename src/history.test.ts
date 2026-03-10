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

describe("JsonlHistory", () => {
  it("appends and reads back recent records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "perf-observer-"));
    tempDirs.push(dir);

    const filePath = join(dir, "history.jsonl");
    const history = new JsonlHistory(filePath);

    await history.append({
      sessionID: "s1",
      messageID: "m1",
      startedAt: 1,
      endedAt: 10,
      outputTokens: 10,
      reasoningTokens: 2,
      totalTokens: 12,
      durationMs: 9,
      averageTps: 1333,
    });

    await history.append({
      sessionID: "s1",
      messageID: "m2",
      startedAt: 11,
      endedAt: 20,
      outputTokens: 20,
      reasoningTokens: 4,
      totalTokens: 24,
      durationMs: 9,
      averageTps: 2666,
    });

    const recent = await history.readRecent(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].messageID).toBe("m2");
  });
});
