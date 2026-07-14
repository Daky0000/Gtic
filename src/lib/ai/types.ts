// Shared AI types — every provider implements AIProvider so the rest of the
// app never touches a vendor SDK directly.

export type ChatRole = "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

/** A system-prompt block; `cache` marks the end of the stable, cacheable prefix. */
export type SystemBlock = { text: string; cache?: boolean };

export type Citation = {
  documentSlug: string;
  documentTitle: string;
  heading: string | null;
};

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type ChatStreamOptions = {
  model: string;
  effort: Effort;
  maxTokens: number;
  system: SystemBlock[];
  messages: ChatMessage[];
};

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

export type ChatStreamResult = {
  /** Text deltas as they arrive. */
  textStream: AsyncGenerator<string>;
  /** Resolves after the stream is fully consumed. */
  final: () => Promise<{ text: string; usage: ChatUsage; stopReason: string }>;
};

export interface AIProvider {
  readonly name: "anthropic" | "mock";
  chatStream(opts: ChatStreamOptions): Promise<ChatStreamResult>;
}

/** Retrieved knowledge context handed to providers alongside the request. */
export type RetrievedChunk = {
  content: string;
  heading: string | null;
  documentSlug: string;
  documentTitle: string;
  rank: number;
};
