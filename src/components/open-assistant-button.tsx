"use client";

/** Sidebar entry point for the floating assistant. Decoupled via a window
 *  event so the shell (a server component) needn't lift the panel's state. */
export function OpenAssistantButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-assistant"))}
      className="flex w-full items-center gap-[11px] rounded-[10px] border border-line bg-cream px-[13px] py-[11px] text-sm text-ink transition-colors hover:border-forest"
    >
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-forest font-mono text-[11px] text-white">
        AI
      </span>
      Assistant
    </button>
  );
}
