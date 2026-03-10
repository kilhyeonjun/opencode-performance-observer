import { tool, type Plugin } from "@opencode-ai/plugin";
import type { AssistantMessage, Event, Message } from "@opencode-ai/sdk";
import { join } from "node:path";
import { JsonlHistory } from "./history.js";
import { SessionStore } from "./session-store.js";
import { estimateTokenDelta } from "./token-estimator.js";

function asAssistant(message: Message): message is AssistantMessage {
  return message.role === "assistant";
}

function getEventTime(event: Event): number {
  if (event.type === "message.part.updated") {
    const part = event.properties.part;
    if (part.type === "text" || part.type === "reasoning") {
      return part.time?.start ?? Date.now();
    }
  }
  if (event.type === "message.updated") {
    return event.properties.info.time.created ?? Date.now();
  }
  return Date.now();
}

export const PerformanceObserverPlugin: Plugin = async ({ client, directory }) => {
  const history = new JsonlHistory(
    join(directory, ".opencode-performance-observer", "history.jsonl"),
  );
  const store = new SessionStore(history, 2000);
  const messageRoles = new Map<string, "assistant" | "user">();
  const partCharLength = new Map<string, number>();
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

    async event({ event }) {
      if (event.type === "message.updated") {
        const info = event.properties.info;
        if (!asAssistant(info)) return;

        messageRoles.set(info.id, "assistant");
        store.beginTurn(info.sessionID, info.id, info.time.created);

        const key = `${info.sessionID}:${info.id}`;
        if (info.finish === "stop" && !finalized.has(key)) {
          finalized.add(key);
          const record = await store.finishTurn(info.sessionID, info.id, info.time.completed ?? Date.now(), {
            output: info.tokens.output,
            reasoning: info.tokens.reasoning,
          });

          if (record) {
            const latency =
              record.latencyMs !== undefined
                ? ` latency ${record.latencyMs}ms`
                : "";
            await client.tui.showToast({
              body: {
                message: `Turn avg ${record.averageTps.toFixed(1)} TPS | ${record.totalTokens} tokens${latency}`,
                variant: "success",
                duration: 1200,
              },
            });
          }
        }
        return;
      }

      if (event.type !== "message.part.updated") return;
      const part = event.properties.part;
      if (part.type !== "text" && part.type !== "reasoning") return;
      if (messageRoles.get(part.messageID) !== "assistant") return;

      const now = getEventTime(event);
      const previousLength = partCharLength.get(part.id) ?? 0;
      const currentLength = part.text.length;
      const deltaText = event.properties.delta ?? part.text.slice(previousLength);
      partCharLength.set(part.id, currentLength);

      const tokenDelta = estimateTokenDelta(deltaText);
      if (tokenDelta <= 0) return;

      store.recordDelta(part.sessionID, part.messageID, tokenDelta, now, part.type);

      if (store.shouldEmitToast(part.sessionID, now, 250)) {
        await client.tui.showToast({
          body: {
            message: store.formatLiveLine(part.sessionID, now),
            variant: "info",
            duration: 500,
          },
        });
      }
    },
  };
};


