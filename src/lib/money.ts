// Money is stored as integer pesewas (1 GHS = 100 pesewas) to avoid float error.

export function formatGHS(pesewas: number): string {
  return `GHS ${(pesewas / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function cedisToPesewas(cedis: number): number {
  return Math.round(cedis * 100);
}

/** Percentage of an invoice paid so far — powers fee gates (0–100). */
export function percentPaid(invoice: { total: number; paid: number }): number {
  if (invoice.total <= 0) return 100;
  return Math.min(100, Math.round((invoice.paid / invoice.total) * 100));
}

// ─── USD pricing (Paystack Ghana settles in GHS only) ───
// Fees stay stored in pesewas; the developer-set USD→GHS rate converts a
// dollar price to the pesewas actually charged, and back for display.

/** Parses a developer-entered USD→GHS rate; null when it isn't a usable
 * positive number (guards against a typo silently zeroing every fee). */
export function parseUsdRate(raw: string | null | undefined): number | null {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n >= 0.01 && n <= 10_000 ? n : null;
}

/** "$25" at rate 15.5 → 38750 pesewas (GHS 387.50). */
export function usdToPesewas(usd: number, rate: number): number {
  return Math.round(usd * rate * 100);
}

/** 38750 pesewas at rate 15.5 → "$25.00" for display next to GHS amounts. */
export function formatUSDEquivalent(pesewas: number, rate: number): string {
  return `$${(pesewas / 100 / rate).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Processing fee ───
// A developer-set percentage added on top of a fee only at the moment a real
// Paystack checkout is started — never on the sticker price shown while
// browsing/applying. e.g. a GHS 50 course fee becomes GHS 50.50 to charge at
// 1%. The invoice ledger always keeps crediting the base amount; the fee is
// a checkout-time surcharge, not revenue owed to the institution.

/** Parses a developer-entered processing-fee percentage; null when it isn't
 * a usable non-negative number (0 is valid — "no fee"). */
export function parseProcessingFeePercent(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/** GHS 50 at 1% → 5050 pesewas (GHS 50.50) to actually charge at checkout. */
export function applyProcessingFee(pesewas: number, percent: number): number {
  return Math.round(pesewas * (1 + percent / 100));
}
