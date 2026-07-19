"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentUser, requireRole, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { parseFields, slugify, FIELD_TYPES, PLACEMENTS, type FieldType, type Placement } from "@/lib/forms";

/** Form building and response viewing: admin (system admin) and developer. */
async function requireFormsConsole() {
  return requireRole(ROLES.SYSTEM_ADMIN);
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// ─── Building (console) ───

export async function createForm(formData: FormData) {
  const user = await requireFormsConsole();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (title.length < 3) fail("/admin/forms", "Give the form a title (at least 3 characters).");

  const base = slugify(title);
  const taken = await db.formDef.findUnique({ where: { slug: base } });
  const slug = taken ? `${base}-${randomBytes(3).toString("hex")}` : base;

  const form = await db.formDef.create({
    data: { slug, title, description, createdById: user.id },
  });
  await audit({ actorId: user.id, action: "forms.created", entityType: "FormDef", entityId: form.id });
  redirect(`/admin/forms/${form.id}`);
}

/** Edits a form's title, description (its intro text) and placement — where
 * its entry point is surfaced. Works for both generic and admission forms. */
export async function updateFormMeta(formData: FormData) {
  const user = await requireFormsConsole();
  const formId = String(formData.get("formId"));
  const back = `/admin/forms/${formId}`;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const placement = String(formData.get("placement")) as Placement;
  if (title.length < 3) fail(back, "Give the form a title (at least 3 characters).");
  if (!PLACEMENTS.includes(placement)) fail(back, "Pick a valid location.");

  await db.formDef.update({ where: { id: formId }, data: { title, description, placement } });
  await audit({ actorId: user.id, action: "forms.meta_updated", entityType: "FormDef", entityId: formId });
  redirect(`${back}?saved=1`);
}

export async function addFormField(formData: FormData) {
  const user = await requireFormsConsole();
  const formId = String(formData.get("formId"));
  const back = `/admin/forms/${formId}`;
  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type")) as FieldType;
  const required = !!formData.get("required");
  const optionsRaw = String(formData.get("options") ?? "").trim();

  if (!label) fail(back, "Give the question a label.");
  if (!FIELD_TYPES.includes(type)) fail(back, "Pick a valid question type.");
  const options = optionsRaw
    ? optionsRaw.split(",").map((o) => o.trim()).filter(Boolean).slice(0, 20)
    : undefined;
  if ((type === "SELECT" || type === "CHECKBOX") && (!options || options.length < 2)) {
    fail(back, "Choice questions need at least two comma-separated options.");
  }

  const form = await db.formDef.findUniqueOrThrow({ where: { id: formId } });
  const fields = parseFields(form.fields);
  if (fields.length >= 40) fail(back, "A form can have at most 40 questions.");
  fields.push({ id: `f${randomBytes(4).toString("hex")}`, label, type, required, options });

  await db.formDef.update({ where: { id: formId }, data: { fields } });
  await audit({ actorId: user.id, action: "forms.field_added", entityType: "FormDef", entityId: formId });
  redirect(back);
}

export async function deleteFormField(formData: FormData) {
  const user = await requireFormsConsole();
  const formId = String(formData.get("formId"));
  const fieldId = String(formData.get("fieldId"));
  const form = await db.formDef.findUniqueOrThrow({ where: { id: formId } });
  const fields = parseFields(form.fields).filter((f) => f.id !== fieldId);
  await db.formDef.update({ where: { id: formId }, data: { fields } });
  await audit({ actorId: user.id, action: "forms.field_removed", entityType: "FormDef", entityId: formId });
  redirect(`/admin/forms/${formId}`);
}

export async function moveFormField(formData: FormData) {
  await requireFormsConsole();
  const formId = String(formData.get("formId"));
  const fieldId = String(formData.get("fieldId"));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;
  const form = await db.formDef.findUniqueOrThrow({ where: { id: formId } });
  const fields = parseFields(form.fields);
  const i = fields.findIndex((f) => f.id === fieldId);
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < fields.length) {
    [fields[i], fields[j]] = [fields[j], fields[i]];
    await db.formDef.update({ where: { id: formId }, data: { fields } });
  }
  redirect(`/admin/forms/${formId}`);
}

export async function setFormStatus(formData: FormData) {
  const user = await requireFormsConsole();
  const formId = String(formData.get("formId"));
  const status = String(formData.get("status"));
  if (!["DRAFT", "PUBLISHED", "CLOSED"].includes(status)) fail(`/admin/forms/${formId}`, "Invalid status.");

  const form = await db.formDef.findUniqueOrThrow({ where: { id: formId } });
  // The admission form's questions are its fixed application fields, so it
  // needs none of its own to publish; generic forms need at least one.
  if (status === "PUBLISHED" && form.type !== "ADMISSION" && parseFields(form.fields).length === 0) {
    fail(`/admin/forms/${formId}`, "Add at least one question before publishing.");
  }
  await db.formDef.update({ where: { id: formId }, data: { status: status as "DRAFT" | "PUBLISHED" | "CLOSED" } });
  await audit({ actorId: user.id, action: `forms.${status.toLowerCase()}`, entityType: "FormDef", entityId: formId });
  redirect(`/admin/forms/${formId}?saved=1`);
}

export async function deleteForm(formData: FormData) {
  const user = await requireFormsConsole();
  const formId = String(formData.get("formId"));
  const form = await db.formDef.delete({ where: { id: formId } }); // responses cascade
  await audit({
    actorId: user.id, action: "forms.deleted", entityType: "FormDef",
    entityId: formId, after: { title: form.title },
  });
  redirect("/admin/forms?saved=1");
}

// ─── Filling (public link) ───

const MAX_ANSWER_CHARS = 5000;

export async function submitFormResponse(formData: FormData) {
  const slug = String(formData.get("slug"));
  const back = `/forms/${slug}`;
  const form = await db.formDef.findUnique({ where: { slug } });
  if (!form || form.status !== "PUBLISHED") fail(back, "This form is not accepting responses.");

  const user = await getCurrentUser();
  const fields = parseFields(form.fields);
  const answers: Record<string, string | string[]> = {};

  for (const f of fields) {
    if (f.type === "CHECKBOX") {
      const values = formData.getAll(f.id).map((v) => String(v).slice(0, MAX_ANSWER_CHARS));
      const valid = values.filter((v) => f.options?.includes(v));
      if (f.required && valid.length === 0) fail(back, `"${f.label}" is required.`);
      if (valid.length > 0) answers[f.id] = valid;
      continue;
    }
    const value = String(formData.get(f.id) ?? "").trim().slice(0, MAX_ANSWER_CHARS);
    if (f.required && !value) fail(back, `"${f.label}" is required.`);
    if (f.type === "SELECT" && value && !f.options?.includes(value)) {
      fail(back, `Choose one of the listed options for "${f.label}".`);
    }
    if (f.type === "NUMBER" && value && !Number.isFinite(Number(value))) {
      fail(back, `"${f.label}" must be a number.`);
    }
    if (value) answers[f.id] = value;
  }

  const respondentName = user ? null : String(formData.get("respondentName") ?? "").trim().slice(0, 200) || null;
  const respondentEmail = user ? null : String(formData.get("respondentEmail") ?? "").trim().slice(0, 200) || null;

  await db.formResponse.create({
    data: { formId: form.id, userId: user?.id ?? null, respondentName, respondentEmail, answers },
  });
  redirect(`${back}?done=1`);
}
