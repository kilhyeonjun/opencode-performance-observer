# opencode-performance-observer

Personal OpenCode plugin focused on:

- Real-time TPS visibility per session (TUI friendly)
- Lightweight session summary for tokens/latency
- Minimal local history for trend checks

## Why this project

This repository is intentionally **not a fork**.
It references ideas from existing ecosystem plugins, but the implementation is written from scratch to keep full control over behavior and stability.

## Initial scope (v0.1)

- Session-scoped instant TPS and average TPS
- Time-to-first-token latency per assistant turn
- Compact TUI output with low noise
- Safe defaults and graceful fallback when telemetry is missing

## Planned roadmap

- v0.2: Session summary command (`/perf`) and JSONL history
- v0.3: Provider/model comparison and optional cost estimate
- v0.4: Configurable thresholds and alerts

## Local development

```bash
npm install
npm test
npm run build
```

## OpenCode install (local path)

Add this plugin path to your OpenCode config:

```json
{
  "plugin": [
    "file:///Users/gameduo/kilhyeonjun/opencode-performance-observer"
  ]
}
```

## What it does now

- Shows live TPS toasts during assistant streaming
- Shows turn-end summary toast with average TPS and latency
- Exposes `perf_summary` tool for quick session summaries
- Writes JSONL history to `.opencode-performance-observer/history.jsonl`

To use `/perf`, copy `command/perf.md` into your OpenCode command directory:

```bash
mkdir -p ~/.config/opencode/command
cp command/perf.md ~/.config/opencode/command/perf.md
```

## Project status

Scaffolded and ready for first implementation pass.
