// Form-builder shared types and helpers. Field definitions are stored as a
// JSON array on FormDef.fields; responses store {fieldId: answer} JSON.

export const FIELD_TYPES = ["TEXT", "PARAGRAPH", "SELECT", "CHECKBOX", "NUMBER", "DATE"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  TEXT: "Short answer",
  PARAGRAPH: "Paragraph",
  SELECT: "Multiple choice (pick one)",
  CHECKBOX: "Checkboxes (pick any)",
  NUMBER: "Number",
  DATE: "Date",
};

export type FormFieldDef = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** For SELECT / CHECKBOX. */
  options?: string[];
};

/** Fields JSON → typed array; tolerant of malformed rows (skipped). */
export function parseFields(raw: unknown): FormFieldDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is FormFieldDef =>
      !!f && typeof f === "object" &&
      typeof (f as FormFieldDef).id === "string" &&
      typeof (f as FormFieldDef).label === "string" &&
      FIELD_TYPES.includes((f as FormFieldDef).type)
  );
}

/** "Trainee feedback 2026" → "trainee-feedback-2026". Uniqueness comes from
 * a random suffix added by the action when needed. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "form";
}
