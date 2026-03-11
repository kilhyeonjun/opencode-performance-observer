import { ThroughputTracker } from "./tracker.js";
import type { HistorySink, SessionHistoryRecord } from "./history.js";

type TurnState = {
  sessionID: string;
  messageID: string;
  startedAt: number;
  firstTokenAt?: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type SessionState = {
  tracker: ThroughputTracker;
  turns: Map<string, TurnState>;
  lastToastAt: number;
  lastAverageTps: number;
};

export class SessionStore {
  private readonly sessions = new Map<string, SessionState>();

  constructor(
    private readonly history?: HistorySink,
    private readonly windowMs = 2000,
  ) {}

  beginTurn(sessionID: string, messageID: string, startedAt: number): void {
    const session = this.getOrCreate(sessionID, startedAt);
    if (session.turns.has(messageID)) return;
    session.turns.set(messageID, {
      sessionID,
      messageID,
      startedAt,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    });
  }

  recordDelta(
    sessionID: string,
    messageID: string,
    tokenDelta: number,
    at: number,
    partType: "text" | "reasoning",
  ): void {
    const session = this.getOrCreate(sessionID, at);
    const turn = session.turns.get(messageID);
    if (!turn) return;

    turn.totalTokens += tokenDelta;
    if (partType === "reasoning") {
      turn.reasoningTokens += tokenDelta;
    } else {
      turn.outputTokens += tokenDelta;
    }

    if (!turn.firstTokenAt) turn.firstTokenAt = at;
    session.tracker.record(tokenDelta, at);
  }

  shouldEmitToast(sessionID: string, now: number, everyMs: number): boolean {
    const session = this.sessions.get(sessionID);
    if (!session) return false;
    if (now - session.lastToastAt < everyMs) return false;
    session.lastToastAt = now;
    return true;
  }

  tps(sessionID: string, now: number): { instant: number; average: number } {
    const session = this.sessions.get(sessionID);
    if (!session) return { instant: 0, average: 0 };
    const instant = session.tracker.instantTps(now);
    const average = session.tracker.averageTps(now);
    session.lastAverageTps = average;
    return { instant, average };
  }

  async finishTurn(
    sessionID: string,
    messageID: string,
    endedAt: number,
    meta: {
      modelID: string;
      providerID: string;
      cost: number;
      input: number;
      output: number;
      reasoning: number;
      cacheRead: number;
      cacheWrite: number;
    },
  ): Promise<SessionHistoryRecord | undefined> {
    const session = this.sessions.get(sessionID);
    if (!session) return undefined;
    const turn = session.turns.get(messageID);
    if (!turn) return undefined;

    turn.outputTokens = meta.output;
    turn.reasoningTokens = meta.reasoning;
    turn.totalTokens = meta.output + meta.reasoning;

    const durationMs = Math.max(endedAt - turn.startedAt, 1);
    const latencyMs = turn.firstTokenAt
      ? Math.max(turn.firstTokenAt - turn.startedAt, 0)
      : undefined;
    const avg = turn.totalTokens / (durationMs / 1000);

    const record: SessionHistoryRecord = {
      sessionID,
      messageID,
      modelID: meta.modelID,
      providerID: meta.providerID,
      startedAt: turn.startedAt,
      firstTokenAt: turn.firstTokenAt,
      endedAt,
      inputTokens: meta.input,
      outputTokens: turn.outputTokens,
      reasoningTokens: turn.reasoningTokens,
      cacheReadTokens: meta.cacheRead,
      cacheWriteTokens: meta.cacheWrite,
      totalTokens: turn.totalTokens,
      cost: meta.cost,
      latencyMs,
      durationMs,
      averageTps: avg,
    };

    session.turns.delete(messageID);
    if (this.history) {
      await this.history.append(record);
    }
    return record;
  }

  formatLiveLine(sessionID: string, now: number): string {
    const { instant, average } = this.tps(sessionID, now);
    return `TPS ${instant.toFixed(1)} | avg ${average.toFixed(1)}`;
  }

  private getOrCreate(sessionID: string, now: number): SessionState {
    const existing = this.sessions.get(sessionID);
    if (existing) return existing;
    const created: SessionState = {
      tracker: new ThroughputTracker(this.windowMs, now),
      turns: new Map(),
      lastToastAt: 0,
      lastAverageTps: 0,
    };
    this.sessions.set(sessionID, created);
    return created;
  }
}
