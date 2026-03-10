export type PerfSample = {
  ts: number;
  tokens: number;
};

export class ThroughputTracker {
  private readonly samples: PerfSample[] = [];
  private readonly windowMs: number;
  private readonly startedAt: number;

  constructor(windowMs = 2000, startedAt = Date.now()) {
    this.windowMs = windowMs;
    this.startedAt = startedAt;
  }

  record(tokens: number, ts = Date.now()): void {
    if (tokens <= 0) return;
    this.samples.push({ ts, tokens });
    this.prune(ts);
  }

  instantTps(now = Date.now()): number {
    this.prune(now);
    if (this.samples.length === 0) return 0;
    const cutoff = now - this.windowMs;
    const inWindow = this.samples.filter((s) => s.ts >= cutoff);
    const tokenSum = inWindow.reduce((sum, s) => sum + s.tokens, 0);
    return tokenSum / (this.windowMs / 1000);
  }

  averageTps(now = Date.now()): number {
    const elapsedMs = Math.max(now - this.startedAt, 1);
    const total = this.samples.reduce((sum, s) => sum + s.tokens, 0);
    return total / (elapsedMs / 1000);
  }

  totalTokens(): number {
    return this.samples.reduce((sum, s) => sum + s.tokens, 0);
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].ts < cutoff) {
      this.samples.shift();
    }
  }
}
