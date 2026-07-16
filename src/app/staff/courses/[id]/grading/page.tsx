import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getOrCreateGradeSheet, saveGradeEntries, submitGradeSheet } from "@/lib/actions/exams";

export const metadata = { title: "Grading" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted — awaiting HoD approval",
  HOD_APPROVED: "HoD approved — awaiting Dean", DEAN_APPROVED: "Dean approved — awaiting Exams Office",
  VALIDATED: "Validated — awaiting Registrar publication", PUBLISHED: "Published to students",
  RETURNED: "Returned for correction",
};

export default async function GradingPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePortal("staff");
  const { id: offeringId } = await params;
  const { error } = await searchParams;

  const offering = await db.courseOffering.findUnique({
    where: { id: offeringId },
    include: { course: true, semester: true, lecturers: true },
  });
  if (!offering) notFound();

  const isAssigned = offering.lecturers.some((l) => l.staffUserId === user.id);
  if (!isAssigned && !hasRole(user, ROLES.SYSTEM_ADMIN)) {
    return <p className="text-red-700">You are not assigned to this course.</p>;
  }

  const sheet = await getOrCreateGradeSheet(offeringId);
  const editable = sheet.status === "DRAFT" || sheet.status === "RETURNED";

  const registrations = await db.registrationCourse.findMany({
    where: { offeringId, registration: { status: "SUBMITTED" } },
    include: { registration: { include: { student: { include: { user: true } } } } },
  });
  const students = registrations.map((r) => r.registration.student).sort((a, b) => a.user.name.localeCompare(b.user.name));

  const entries = await db.gradeEntry.findMany({ where: { gradeSheetId: sheet.id } });
  const entryByStudent = new Map(entries.map((e) => [e.studentId, e]));

  return (
    <div>
      <Link href={`/staff/courses/${offeringId}`} className="text-sm text-ink-500 hover:underline">← Class list</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{offering.course.code} — Grading</h1>
        <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700">{STATUS_LABEL[sheet.status]}</span>
      </div>
      <p className="text-sm text-ink-500">CA out of {sheet.caWeight}, Exam out of {sheet.examWeight}</p>

      {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <form action={saveGradeEntries} className="mt-4">
        <input type="hidden" name="gradeSheetId" value={sheet.id} />
        <input type="hidden" name="offeringId" value={offeringId} />
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase text-ink-500">
              <tr><th className="px-4 py-2">Student</th><th className="px-4 py-2">CA</th><th className="px-4 py-2">Exam</th><th className="px-4 py-2">Total</th></tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const entry = entryByStudent.get(s.id);
                return (
                  <tr key={s.id} className="border-t border-ink-100">
                    <td className="px-4 py-2">
                      <input type="hidden" name="studentId" value={s.id} />
                      {s.user.name} <span className="text-xs text-ink-500">({s.indexNo})</span>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number" step="0.5" min={0} max={sheet.caWeight}
                        name={`ca_${s.id}`} defaultValue={entry?.caScore ?? ""} disabled={!editable}
                        className="w-20 rounded-md border border-ink-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number" step="0.5" min={0} max={sheet.examWeight}
                        name={`exam_${s.id}`} defaultValue={entry?.examScore ?? ""} disabled={!editable}
                        className="w-20 rounded-md border border-ink-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2 font-mono">{entry?.total ?? "—"} {entry?.grade && `(${entry.grade})`}</td>
                  </tr>
                );
              })}
              {students.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No registered students.</td></tr>}
            </tbody>
          </table>
        </div>
        {editable && (
          <button type="submit" className="mt-3 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
            Save scores
          </button>
        )}
      </form>

      {editable && students.length > 0 && (
        <form action={submitGradeSheet} className="mt-4">
          <input type="hidden" name="gradeSheetId" value={sheet.id} />
          <input type="hidden" name="offeringId" value={offeringId} />
          <button type="submit" className="rounded-md border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100">
            Submit for approval
          </button>
        </form>
      )}
    </div>
  );
}
