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
