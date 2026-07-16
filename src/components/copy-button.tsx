"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the value is
      // still visible on screen for manual copying.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-line bg-paper px-[14px] py-1.5 text-xs font-medium text-forest transition-colors hover:border-forest"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
