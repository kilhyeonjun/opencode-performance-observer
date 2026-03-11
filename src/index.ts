import { tool, type Plugin } from "@opencode-ai/plugin";
import type { AssistantMessage, Event, Message } from "@opencode-ai/sdk";
import { join } from "node:path";
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { JsonlHistory } from "./history.js";
import { SessionStore } from "./session-store.js";
import { estimateTokenDelta } from "./token-estimator.js";

interface PartDeltaEvent {
  type: "message.part.delta";
  properties: {
    sessionID: string;
    messageID: string;
    partID: string;
    field: string;
    delta: string;
  };
}

function asAssistant(message: Message): message is AssistantMessage {
  return message.role === "assistant";
}

const LOG_PATH = join(
  process.env.TMPDIR ?? "/tmp",
  "opencode-perf-observer-debug.log",
);

function debugLog(msg: string) {
  try {
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

export const PerformanceObserverPlugin: Plugin = async ({ client }) => {
  const historyDir = join(
    homedir(),
    ".local",
    "share",
    "opencode",
    "opencode-performance-observer",
  );
  debugLog(`PLUGIN_INIT historyDir=${historyDir}`);

  const history = new JsonlHistory(join(historyDir, "history.jsonl"));
  const store = new SessionStore(history, 2000);
  const finalized = new Set<string>();

  return {
    tool: {
      perf_summary: tool({
        description: "Show recent performance summary for this session",
        args: {
          limit: tool.schema
            .number()
            .min(1)
            .max(20)
            .default(5)
            .describe("How many recent turns to include"),
        },
        async execute(args, context) {
          const recent = await history.readRecent(args.limit);
          const current = recent.filter((r) => r.sessionID === context.sessionID);
          if (current.length === 0) {
            return "No performance history yet for this session.";
          }

          const lines = current.map((row, index) => {
            const latency = row.latencyMs !== undefined ? `${row.latencyMs}ms` : "n/a";
            return `${index + 1}. avgTPS=${row.averageTps.toFixed(1)} latency=${latency} tokens=${row.totalTokens} duration=${row.durationMs}ms`;
          });
          return [`Session ${context.sessionID} recent turns:`, ...lines].join("\n");
        },
      }),
    },

    event: async ({ event }) => {
      try {
        const eventType = event.type as string;
        if (eventType === "message.updated") {
          const { info } = (event as { type: string; properties: { info: Message } }).properties;
          if (!asAssistant(info)) return;

          store.beginTurn(info.sessionID, info.id, info.time.created);

          const key = `${info.sessionID}:${info.id}`;
          if (info.finish === "stop" && !finalized.has(key)) {
            finalized.add(key);
            debugLog(`TURN_FINISH msg=${info.id} tokens_out=${info.tokens.output}`);
            const record = await store.finishTurn(info.sessionID, info.id, info.time.completed ?? Date.now(), {
              output: info.tokens.output,
              reasoning: info.tokens.reasoning,
            });

            if (record) {
              const latency =
                record.latencyMs !== undefined
                  ? ` latency ${record.latencyMs}ms`
                  : "";
              debugLog(`TOAST_SUMMARY avg=${record.averageTps.toFixed(1)} total=${record.totalTokens}`);
              await client.tui.showToast({
                body: {
                  message: `Turn avg ${record.averageTps.toFixed(1)} TPS | ${record.totalTokens} tokens${latency}`,
                  variant: "success",
                  duration: 1200,
                },
              }).catch(() => {});
            }
          }
          return;
        }

        if (eventType === "message.part.delta") {
          const delta = event as unknown as PartDeltaEvent;
          const { sessionID, messageID, partID, field, delta: text } = delta.properties;
          if (field !== "text" && field !== "reasoning") return;

          const tokenDelta = estimateTokenDelta(text);
          if (tokenDelta <= 0) return;

          const now = Date.now();
          store.recordDelta(sessionID, messageID, tokenDelta, now, field);

          if (store.shouldEmitToast(sessionID, now, 250)) {
            const line = store.formatLiveLine(sessionID, now);
            debugLog(`TOAST_LIVE ${line}`);
            await client.tui.showToast({
              body: {
                message: line,
                variant: "info",
                duration: 500,
              },
            }).catch(() => {});
          }
          return;
        }
      } catch (err) {
        debugLog(`ERROR ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
};
