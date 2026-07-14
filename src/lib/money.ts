// Money is stored as integer pesewas (1 GHS = 100 pesewas) to avoid float error.

export function formatGHS(pesewas: number): string {
  return `GHS ${(pesewas / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function cedisToPesewas(cedis: number): number {
  return Math.round(cedis * 100);
}
