import { mkdir, appendFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export type SessionHistoryRecord = {
  sessionID: string;
  messageID: string;
  modelID: string;
  providerID: string;
  startedAt: number;
  firstTokenAt?: number;
  endedAt: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
  latencyMs?: number;
  durationMs: number;
  averageTps: number;
};

export interface HistorySink {
  append(record: SessionHistoryRecord): Promise<void>;
}

export class JsonlHistory implements HistorySink {
  constructor(private readonly filePath: string) {}

  async append(record: SessionHistoryRecord): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }

  async readRecent(limit: number): Promise<SessionHistoryRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const lines = raw.split("\n").filter(Boolean);
      const parsed = lines
        .map((line) => JSON.parse(line) as SessionHistoryRecord)
        .slice(-limit)
        .reverse();
      return parsed;
    } catch {
      return [];
    }
  }
}
