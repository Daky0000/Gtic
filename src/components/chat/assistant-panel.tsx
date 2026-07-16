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

  // Sidebar "Assistant" entry opens the panel via a window event.
  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener("open-assistant", openPanel);
    return () => window.removeEventListener("open-assistant", openPanel);
  }, []);

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
        className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-forest p-3.5 text-white shadow-lg transition-colors hover:bg-forest-deep"
      >
        {open ? (
          <span className="text-lg leading-none">×</span>
        ) : (
          <span className="font-mono text-sm font-medium">AI</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[70vh] max-h-[560px] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[18px] border border-line bg-paper shadow-2xl">
          <div className="flex items-center gap-3 border-b border-line bg-forest px-4 py-3 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/15 font-mono text-[13px]">
              AI
            </span>
            <div>
              <div className="font-serif text-[17px] leading-none">SYDA Assistant</div>
              <div className="mt-1 text-[11px] text-[#a9c7b2]">
                Answers from official Center documents
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="rounded-[14px] border border-line bg-cream p-3 text-sm leading-[1.55] text-muted">
                Ask me about programmes, admission requirements, examination rules or fees. I answer
                only from the Center&apos;s published documents.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-[16px] bg-forest px-[14px] py-[10px] text-sm leading-[1.55] text-white"
                      : "max-w-[85%] whitespace-pre-wrap rounded-[16px] border border-line bg-cream px-[14px] py-[10px] text-sm leading-[1.55] text-ink"
                  }
                >
                  {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2 border-t border-line pt-1.5 text-xs text-faint">
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
            className="flex gap-2 border-t border-line p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="min-w-0 flex-1 rounded-full border border-line bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-forest"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-deep disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
