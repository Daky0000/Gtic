// Shared visual helpers for programmes. The redesign gives each programme a
// coloured accent dot and a monospace code chip; neither is stored in the DB,
// so we derive them deterministically from real programme data.

export const PROGRAMME_TINTS = [
  "#E7B54A", // gold
  "#8AA84B", // moss-green
  "#6FA9C4", // sky
  "#C57B57", // clay
  "#7E6BB0", // violet
  "#3B7A54", // forest-moss
];

/** Stable tint for a programme, keyed off its code so it never shifts. */
export function programmeTint(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  return PROGRAMME_TINTS[Math.abs(h) % PROGRAMME_TINTS.length];
}

/** "SENG · DSE"-style code chip; the department code is appended when known. */
export function programmeCode(code: string, deptCode?: string): string {
  return deptCode ? `${code} · ${deptCode}` : code;
}
