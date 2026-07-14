import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createCandidature, decideMilestone, graduateStudent } from "@/lib/actions/graduate";

export const metadata = { title: "Graduate Studies" };

export default async function GraduateStudiesPage() {
  const user = await requirePortal("staff");
  const canCreate = hasRole(user, ROLES.GRAD_SCHOOL_OFFICER, ROLES.SYSTEM_ADMIN);
  const canGraduate = hasRole(user, ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);

  const withoutCandidature = await db.student.findMany({
    where: { status: "ACTIVE", candidature: null },
    include: { user: true, programme: true },
  });
  const candidatures = await db.candidature.findMany({
    include: { student: { include: { user: true } }, milestones: { orderBy: { ord: "asc" } } },
  });
  const staff = await db.staffProfile.findMany({ include: { user: true } });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Graduate studies</h1>

      {canCreate && (
        <form action={createCandidature} className="mt-4 grid gap-2 rounded-lg border border-ink-300/60 bg-white p-4 sm:grid-cols-4">
          <select name="studentId" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm sm:col-span-2">
            {withoutCandidature.map((s) => <option key={s.id} value={s.id}>{s.user.name} ({s.programme.name})</option>)}
          </select>
          <select name="supervisorUserId" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm">
            {staff.map((s) => <option key={s.userId} value={s.userId}>{s.user.name}</option>)}
          </select>
          <input name="topic" placeholder="Research topic" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 sm:col-span-4">
            Start candidature
          </button>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {candidatures.map((c) => (
          <div key={c.id} className="rounded-lg border border-ink-300/60 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{c.student.user.name}</div>
              {canGraduate && c.milestones.every((m) => m.status === "APPROVED") && (
                <form action={graduateStudent}><input type="hidden" name="studentId" value={c.studentId} /><button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">Confer degree</button></form>
              )}
            </div>
            {c.topic && <p className="text-xs text-ink-500">{c.topic}</p>}
            <div className="mt-2 flex flex-wrap gap-1">
              {c.milestones.map((m) => (
                <span key={m.id} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  m.status === "APPROVED" ? "bg-brand-100 text-brand-800" :
                  m.status === "SUBMITTED" ? "bg-amber-100 text-amber-800" :
                  m.status === "RETURNED" ? "bg-red-100 text-red-800" : "bg-ink-100 text-ink-600"
                }`}>
                  {m.name}
                </span>
              ))}
            </div>
            {c.milestones.filter((m) => m.status === "SUBMITTED").map((m) => (
              <form key={m.id} action={decideMilestone} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="milestoneId" value={m.id} />
                <span className="text-xs">{m.name} awaiting your review:</span>
                <input name="feedback" placeholder="Feedback" className="rounded border border-ink-300 px-2 py-1 text-xs" />
                <button type="submit" name="decision" value="APPROVED" className="rounded bg-brand-800 px-2 py-1 text-xs text-white hover:bg-brand-700">Approve</button>
                <button type="submit" name="decision" value="RETURNED" className="rounded border border-ink-300 px-2 py-1 text-xs text-ink-700 hover:bg-ink-100">Return</button>
              </form>
            ))}
          </div>
        ))}
        {candidatures.length === 0 && <p className="text-sm text-ink-500">No candidatures yet.</p>}
      </div>
    </div>
  );
}
