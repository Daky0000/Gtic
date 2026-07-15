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
      className="rounded-md border border-brand-300 bg-white px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
