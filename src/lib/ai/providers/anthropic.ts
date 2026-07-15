import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider, ChatStreamOptions, ChatStreamResult, ChatUsage,
} from "../types";

// The API key can be changed at runtime from the developer console;
// resolveProvider() pushes the effective key here before every call and the
// client is rebuilt whenever it changes.
let resolvedKey: string | undefined = process.env.ANTHROPIC_API_KEY;
let client: Anthropic | null = null;
let clientKey: string | undefined;

export function setAnthropicKey(key: string | undefined) {
  resolvedKey = key ?? process.env.ANTHROPIC_API_KEY;
}

export function getClient(): Anthropic {
  if (!client || clientKey !== resolvedKey) {
    client = new Anthropic({ apiKey: resolvedKey });
    clientKey = resolvedKey;
  }
  return client;
}

export const anthropicProvider: AIProvider = {
  name: "anthropic",

  async chatStream(opts: ChatStreamOptions): Promise<ChatStreamResult> {
    const stream = getClient().messages.stream({
      model: opts.model,
      max_tokens: opts.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort },
      system: opts.system.map((b) => ({
        type: "text" as const,
        text: b.text,
        ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
      })),
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    async function* textStream(): AsyncGenerator<string> {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    }

    return {
      textStream: textStream(),
      final: async () => {
        const message = await stream.finalMessage();
        const text = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        const usage: ChatUsage = {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        };
        return { text, usage, stopReason: message.stop_reason ?? "end_turn" };
      },
    };
  },
};
