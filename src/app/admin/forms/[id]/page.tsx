import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { appBaseUrl } from "@/lib/base-url";
import {
  addFormField, deleteForm, deleteFormField, moveFormField, setFormStatus, updateFormMeta,
} from "@/lib/actions/forms";
import { FIELD_TYPE_LABEL, FIELD_TYPES, PLACEMENTS, PLACEMENT_LABEL, parseFields, type Placement } from "@/lib/forms";
import { Flash } from "@/components/flash";
import { StatusChip, type ChipTone } from "@/components/ui";

export const metadata = { title: "Edit Form" };

const STATUS_TONE: Record<string, ChipTone> = { PUBLISHED: "green", DRAFT: "amber", CLOSED: "neutral" };

export default async function EditFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireDeveloperConsole();
  const { id } = await params;
  const { error, saved } = await searchParams;

  const form = await db.formDef.findUnique({
    where: { id },
    include: { _count: { select: { responses: true } } },
  });
  if (!form) notFound();
  const fields = parseFields(form.fields);
  const shareUrl = `${appBaseUrl()}/forms/${form.slug}`;

  const field = "rounded-md border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none";
  const smallBtn = "rounded-md border border-ink-300 px-2 py-1 text-xs text-ink-600 hover:bg-ink-100";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/forms" className="text-xs text-ink-500 hover:text-forest">← All forms</Link>
          <h1 className="text-2xl font-bold">
            {form.title}
            {form.type === "ADMISSION" && (
              <span className="ml-2 rounded-full bg-[#eaf0ea] px-2 py-0.5 align-middle text-xs font-semibold text-forest">
                Admission application
              </span>
            )}
          </h1>
          {form.description && <p className="mt-1 text-sm text-ink-500">{form.description}</p>}
        </div>
        <StatusChip tone={STATUS_TONE[form.status] ?? "neutral"}>{form.status}</StatusChip>
      </div>
      <Flash error={error} success={saved ? "Saved." : undefined} />

      {/* Form settings — title, intro text, and where it appears */}
      <section className="mt-5 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Settings</h2>
        <form action={updateFormMeta} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="formId" value={form.id} />
          <label className="text-xs text-ink-600 sm:col-span-2">
            Title
            <input name="title" required defaultValue={form.title} className={`${field} mt-1 block w-full`} />
          </label>
          <label className="text-xs text-ink-600 sm:col-span-2">
            Intro text {form.type === "ADMISSION" && "(shown to applicants on the apply page)"}
            <input name="description" defaultValue={form.description ?? ""} className={`${field} mt-1 block w-full`} />
          </label>
          <label className="text-xs text-ink-600">
            Where it shows
            <select name="placement" defaultValue={form.placement} className={`${field} mt-1 block w-full`}>
              {PLACEMENTS.map((p) => (
                <option key={p} value={p}>{PLACEMENT_LABEL[p as Placement]}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
              Save settings
            </button>
          </div>
        </form>
      </section>

      {/* Share + status controls */}
      <section className="mt-5 rounded-2xl border border-line bg-paper p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="text-xs text-ink-500">Public link {form.status !== "PUBLISHED" && "(live once published)"}</div>
            <span className="font-mono text-[13px] text-ink">{shareUrl}</span>
          </div>
          <div className="flex items-center gap-2">
            {form.status !== "PUBLISHED" && (
              <form action={setFormStatus}>
                <input type="hidden" name="formId" value={form.id} />
                <input type="hidden" name="status" value="PUBLISHED" />
                <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
                  Publish
                </button>
              </form>
            )}
            {form.status === "PUBLISHED" && (
              <form action={setFormStatus}>
                <input type="hidden" name="formId" value={form.id} />
                <input type="hidden" name="status" value="CLOSED" />
                <button type="submit" className="rounded-full border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-100">
                  Close responses
                </button>
              </form>
            )}
            <Link href={`/admin/forms/${form.id}/responses`} className="rounded-full border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100">
              Responses ({form._count.responses})
            </Link>
          </div>
        </div>
      </section>

      {/* The admission application's questions are its fixed, specialised
          fields (personal details, results, programme choices) — not editable
          as generic questions. Everything else (intro, show/hide, location,
          delete) is managed above. */}
      {form.type === "ADMISSION" && (
        <section className="mt-5 rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Application fields</h2>
          <p className="mt-1 text-sm text-ink-500">
            This is the smart admission application — it keeps the programme picker, AI results-slip
            upload, document upload and fee gating. Use <strong>Publish</strong> to open admissions
            (the Apply links appear on the site) and <strong>Close</strong> to hide them; set where the
            Apply link shows under Settings above.
          </p>
        </section>
      )}

      {/* Questions (generic forms only) */}
      {form.type !== "ADMISSION" && (
      <section className="mt-5 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Questions</h2>
        <div className="mt-3 space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-200 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {i + 1}. {f.label} {f.required && <span className="text-[#b23a2e]">*</span>}
                </div>
                <div className="text-xs text-ink-500">
                  {FIELD_TYPE_LABEL[f.type]}
                  {f.options && ` · ${f.options.join(" / ")}`}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <form action={moveFormField}>
                  <input type="hidden" name="formId" value={form.id} />
                  <input type="hidden" name="fieldId" value={f.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button type="submit" className={smallBtn} aria-label="Move up">↑</button>
                </form>
                <form action={moveFormField}>
                  <input type="hidden" name="formId" value={form.id} />
                  <input type="hidden" name="fieldId" value={f.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button type="submit" className={smallBtn} aria-label="Move down">↓</button>
                </form>
                <form action={deleteFormField}>
                  <input type="hidden" name="formId" value={form.id} />
                  <input type="hidden" name="fieldId" value={f.id} />
                  <button type="submit" className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50">Remove</button>
                </form>
              </div>
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm text-ink-500">No questions yet — add the first one below.</p>}
        </div>

        <form action={addFormField} className="mt-4 grid gap-3 border-t border-ink-200 pt-4 sm:grid-cols-2">
          <input type="hidden" name="formId" value={form.id} />
          <label className="text-xs text-ink-600">
            Question label
            <input name="label" required placeholder="e.g. How would you rate the training?" className={`${field} mt-1 block w-full`} />
          </label>
          <label className="text-xs text-ink-600">
            Type
            <select name="type" className={`${field} mt-1 block w-full`}>
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-600 sm:col-span-2">
            Options (for choice questions — comma-separated)
            <input name="options" placeholder="Excellent, Good, Fair, Poor" className={`${field} mt-1 block w-full`} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" name="required" className="h-4 w-4" /> Required
          </label>
          <div className="text-right">
            <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
              Add question
            </button>
          </div>
        </form>
      </section>
      )}

      {/* Danger zone */}
      <section className="mt-5 rounded-2xl border border-[#e3b5ad] bg-[#faece9] p-4">
        <form action={deleteForm} className="flex items-center justify-between gap-3">
          <input type="hidden" name="formId" value={form.id} />
          <span className="text-sm text-[#8a463c]">
            Deleting removes the form AND its {form._count.responses} response(s), permanently.
          </span>
          <button type="submit" className="rounded-full border border-[#b23a2e] px-4 py-2 text-sm font-medium text-[#b23a2e] hover:bg-[#f5ded9]">
            Delete form
          </button>
        </form>
      </section>
    </div>
  );
}
