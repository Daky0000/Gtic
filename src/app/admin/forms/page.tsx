import Link from "next/link";
import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { createForm } from "@/lib/actions/forms";
import { parseFields } from "@/lib/forms";
import { Flash } from "@/components/flash";
import { StatusChip, type ChipTone } from "@/components/ui";

export const metadata = { title: "Forms" };

const STATUS_TONE: Record<string, ChipTone> = { PUBLISHED: "green", DRAFT: "amber", CLOSED: "neutral" };

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireDeveloperConsole();
  const { error, saved } = await searchParams;

  const [forms, needsReview, confirmed] = await Promise.all([
    db.formDef.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { responses: true } } },
    }),
    db.shortCourseRegistration.count({ where: { status: "SUBMITTED" } }),
    db.shortCourseRegistration.count({ where: { status: "CONFIRMED" } }),
  ]);

  const field = "rounded-md border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Forms</h1>
      <p className="mt-1 text-sm text-ink-500">
        Build forms and surveys, share the public link, and view responses and results here.
      </p>
      <Flash error={error} success={saved ? "Done." : undefined} />

      <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">Renewable Energy Training Application</span>
              <StatusChip tone="violet">Short courses</StatusChip>
            </div>
            <p className="mt-0.5 text-xs text-ink-500">
              Solar PV, Wind Energy, Biogas and the Complete course — not built here in the generic form
              builder. It has its own applicant flow (/short-courses), staff review queue and walk-in
              intake, managed on the Short Courses page.
            </p>
          </div>
          <Link href="/staff/short-courses" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
            Manage registrations →
          </Link>
        </div>
        <div className="mt-3 flex gap-5 text-sm">
          <span>
            <strong className="text-ink">{needsReview}</strong> <span className="text-ink-500">awaiting review</span>
          </span>
          <span>
            <strong className="text-ink">{confirmed}</strong> <span className="text-ink-500">confirmed</span>
          </span>
        </div>
      </div>

      <h2 className="mt-8 font-semibold text-ink-700">Form builder</h2>
      <p className="mt-1 text-xs text-ink-500">
        Generic forms and surveys, plus the diploma-programme admission handle below (controls its intro
        text and whether /signup is open — the application itself is a specialized flow, not built here).
      </p>

      <form action={createForm} className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-paper p-5">
        <label className="flex-1 text-xs text-ink-600">
          Title
          <input name="title" required minLength={3} placeholder="e.g. Trainee feedback — January cohort" className={`${field} mt-1 block w-full`} />
        </label>
        <label className="flex-1 text-xs text-ink-600">
          Description (optional)
          <input name="description" placeholder="Shown at the top of the form" className={`${field} mt-1 block w-full`} />
        </label>
        <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
          Create form
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {forms.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-4">
            <div>
              <Link href={`/admin/forms/${f.id}`} className="font-medium text-ink hover:text-forest">
                {f.title}
              </Link>
              <div className="mt-0.5 text-xs text-ink-500">
                {f.type === "ADMISSION"
                  ? `Diploma-programme admission handle · controls /signup`
                  : `${parseFields(f.fields).length} question(s) · /forms/${f.slug}`}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/admin/forms/${f.id}/responses`} className="text-sm text-forest hover:text-moss">
                {f._count.responses} response(s) →
              </Link>
              <StatusChip tone={STATUS_TONE[f.status] ?? "neutral"}>{f.status}</StatusChip>
            </div>
          </div>
        ))}
        {forms.length === 0 && <p className="text-sm text-ink-500">No forms yet — create the first one above.</p>}
      </div>
    </div>
  );
}
