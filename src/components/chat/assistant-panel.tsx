"use client";

import { useEffect, useRef, useState } from "react";

type Citation = { documentSlug: string; documentTitle: string; heading: string | null };
type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const patchAssistant = (fn: (prev: Msg) => Msg) =>
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = fn(copy[copy.length - 1]);
          return copy;
        });

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "delta"; text: string }
            | { type: "citations"; items: Citation[] }
            | { type: "done"; conversationId: string }
            | { type: "error"; message: string };
          if (event.type === "delta") {
            patchAssistant((prev) => ({ ...prev, content: prev.content + event.text }));
          } else if (event.type === "citations") {
            patchAssistant((prev) => ({ ...prev, citations: event.items }));
          } else if (event.type === "done") {
            setConversationId(event.conversationId);
          } else if (event.type === "error") {
            patchAssistant((prev) => ({
              ...prev,
              content: prev.content || event.message,
            }));
          }
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && !last.content) {
          copy[copy.length - 1] = {
            ...last,
            content: "Connection problem — please try again.",
          };
        }
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-brand-800 p-3.5 text-white shadow-lg hover:bg-brand-700"
      >
        {open ? (
          <span className="text-lg leading-none">×</span>
        ) : (
          <span className="text-sm font-semibold">AI</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[70vh] max-h-[560px] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-ink-300/60 bg-white shadow-2xl">
          <div className="border-b border-ink-300/60 bg-brand-800 px-4 py-3 text-white">
            <div className="font-semibold">Campus assistant</div>
            <div className="text-xs text-brand-100">
              Answers come from official Center documents
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="rounded-lg bg-ink-100 p-3 text-sm text-ink-700">
                Ask me about programmes, admission requirements, examination rules
                or fees. I answer only from the Center&apos;s published documents.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-lg bg-brand-800 px-3 py-2 text-sm text-white"
                      : "max-w-[85%] whitespace-pre-wrap rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-900"
                  }
                >
                  {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2 border-t border-ink-300/60 pt-1.5 text-xs text-ink-500">
                      Sources:{" "}
                      {[...new Map(m.citations.map((c) => [c.documentSlug, c])).values()]
                        .map((c) => c.documentTitle)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex gap-2 border-t border-ink-300/60 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="min-w-0 flex-1 rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
