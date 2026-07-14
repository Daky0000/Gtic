import "server-only";
import type {
  AIProvider, ChatStreamOptions, ChatStreamResult, ChatUsage,
} from "../types";

/**
 * Deterministic offline provider. Mirrors the grounding behaviour of the real
 * assistant: it "answers" by quoting the knowledge context the service put in
 * the system prompt, and refuses when there is none. Used in development, CI
 * and any deployment without an Anthropic API key.
 */
export const mockProvider: AIProvider = {
  name: "mock",

  async chatStream(opts: ChatStreamOptions): Promise<ChatStreamResult> {
    const contextBlock = opts.system.find((b) => b.text.startsWith("KNOWLEDGE CONTEXT"));
    const question = opts.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

    let answer: string;
    if (contextBlock && contextBlock.text.includes("[source:")) {
      const firstSource = contextBlock.text.match(/\[source: ([^\]]+)\]/)?.[1] ?? "document";
      const firstPassage =
        contextBlock.text
          .split(/\[source: [^\]]+\]/)[1]
          ?.trim()
          .split("\n\n")[0]
          ?.slice(0, 400) ?? "";
      answer =
        `(mock AI) Based on the university's official documents, here is what applies to ` +
        `your question "${question.slice(0, 120)}":\n\n${firstPassage}\n\n` +
        `Source: ${firstSource}. In production this answer is written by Claude from the same retrieved passages.`;
    } else {
      answer =
        `(mock AI) I could not find anything about this in the university's published ` +
        `documents, so I won't guess. Please contact the relevant office directly — ` +
        `or ask me something covered by the student handbook or examination regulations.`;
    }

    const words = answer.split(/(?<=\s)/); // keep whitespace attached
    async function* textStream(): AsyncGenerator<string> {
      for (const w of words) {
        yield w;
        await new Promise((r) => setTimeout(r, 4));
      }
    }

    const usage: ChatUsage = {
      inputTokens: Math.ceil(opts.system.reduce((n, b) => n + b.text.length, 0) / 4),
      outputTokens: Math.ceil(answer.length / 4),
      cacheReadTokens: 0,
    };

    return {
      textStream: textStream(),
      final: async () => ({ text: answer, usage, stopReason: "end_turn" }),
    };
  },
};
