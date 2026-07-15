import { hasRole, requirePortal, ROLES, type RoleCode } from "@/lib/rbac";
import { db } from "@/lib/db";
import { approveGradeSheet, publishGradeSheet, returnGradeSheet } from "@/lib/actions/exams";
import { Flash } from "@/components/flash";
import type { GradeSheetStatus } from "@prisma/client";

export const metadata = { title: "Approvals" };

const STAGE_FOR_STATUS: Record<string, { role: RoleCode; label: string }> = {
  SUBMITTED: { role: ROLES.HOD, label: "Awaiting HoD approval" },
  HOD_APPROVED: { role: ROLES.DEAN, label: "Awaiting Dean approval" },
  DEAN_APPROVED: { role: ROLES.EXAMS_OFFICER, label: "Awaiting Exams Office validation" },
  VALIDATED: { role: ROLES.REGISTRAR, label: "Awaiting Registrar publication" },
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePortal("staff");
  const { error } = await searchParams;

  const relevantStatuses = Object.keys(STAGE_FOR_STATUS).filter((status) =>
    hasRole(user, STAGE_FOR_STATUS[status].role, ROLES.SYSTEM_ADMIN)
  ) as GradeSheetStatus[];

  const sheets = relevantStatuses.length
    ? await db.gradeSheet.findMany({
        where: { status: { in: relevantStatuses } },
        include: { offering: { include: { course: true, semester: true } }, entries: true },
        orderBy: { submittedAt: "asc" },
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Approvals</h1>
      <Flash error={error} />
      <p className="mt-1 text-sm text-ink-500">Grade sheets awaiting a decision at your role&apos;s stage.</p>

      <div className="mt-6 space-y-4">
        {sheets.map((sheet) => {
          const stage = STAGE_FOR_STATUS[sheet.status];
          const isFinal = sheet.status === "VALIDATED";
          return (
            <div key={sheet.id} className="rounded-lg border border-ink-300/60 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{sheet.offering.course.code} — {sheet.offering.course.title}</div>
                  <div className="text-xs text-ink-500">{sheet.offering.semester.label} · {sheet.entries.length} student(s)</div>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{stage.label}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isFinal ? (
                  <form action={publishGradeSheet}>
                    <input type="hidden" name="gradeSheetId" value={sheet.id} />
                    <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      Publish results
                    </button>
                  </form>
                ) : (
                  <form action={approveGradeSheet}>
                    <input type="hidden" name="gradeSheetId" value={sheet.id} />
                    <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      Approve
                    </button>
                  </form>
                )}
                <form action={returnGradeSheet} className="flex items-center gap-2">
                  <input type="hidden" name="gradeSheetId" value={sheet.id} />
                  <input name="note" placeholder="Reason for return" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
                  <button type="submit" className="rounded-md border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100">
                    Return
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {sheets.length === 0 && <p className="text-sm text-ink-500">Nothing awaiting your approval.</p>}
      </div>
    </div>
  );
}
