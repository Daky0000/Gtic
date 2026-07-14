import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { applyForLeave, decideLeaveRequest } from "@/lib/actions/hr";

export const metadata = { title: "HR" };

export default async function HrPage() {
  const user = await requirePortal("staff");
  const canDecide = hasRole(user, ROLES.HR_OFFICER, ROLES.SYSTEM_ADMIN);

  const myProfile = await db.staffProfile.findUnique({ where: { userId: user.id } });
  const myRequests = await db.leaveRequest.findMany({ where: { staffUserId: user.id }, orderBy: { createdAt: "desc" } });
  const pending = canDecide
    ? await db.leaveRequest.findMany({ where: { status: "PENDING" }, include: { staffUser: true }, orderBy: { createdAt: "asc" } })
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">HR</h1>

      <section className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
        <h2 className="font-semibold text-brand-800">My leave</h2>
        {myProfile && <p className="mt-1 text-sm text-ink-500">Balance: {myProfile.leaveBalance} day(s)</p>}
        <form action={applyForLeave} className="mt-3 grid gap-2 sm:grid-cols-4">
          <select name="type" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm">
            <option value="ANNUAL">Annual</option>
            <option value="SICK">Sick</option>
            <option value="OTHER">Other</option>
          </select>
          <input name="fromDate" type="date" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <input name="toDate" type="date" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          <input name="reason" placeholder="Reason (optional)" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm sm:col-span-4" />
        </form>
        <div className="mt-4 space-y-1 text-sm">
          {myRequests.map((r) => (
            <div key={r.id} className="flex justify-between border-b border-ink-100 py-1">
              <span>{r.type} · {r.fromDate.toLocaleDateString()} – {r.toDate.toLocaleDateString()}</span>
              <span className={r.status === "APPROVED" ? "text-brand-800" : r.status === "REJECTED" ? "text-red-700" : "text-ink-500"}>{r.status}</span>
            </div>
          ))}
          {myRequests.length === 0 && <p className="text-ink-500">No leave requests yet.</p>}
        </div>
      </section>

      {canDecide && (
        <section className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
          <h2 className="font-semibold text-brand-800">Pending leave approvals</h2>
          <div className="mt-3 space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-ink-200 p-3 text-sm">
                <span>{r.staffUser.name} — {r.type} ({r.fromDate.toLocaleDateString()} – {r.toDate.toLocaleDateString()})</span>
                <div className="flex gap-2">
                  <form action={decideLeaveRequest}><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="APPROVED" /><button type="submit" className="rounded bg-brand-800 px-2 py-1 text-xs text-white hover:bg-brand-700">Approve</button></form>
                  <form action={decideLeaveRequest}><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="REJECTED" /><button type="submit" className="rounded border border-ink-300 px-2 py-1 text-xs text-ink-700 hover:bg-ink-100">Reject</button></form>
                </div>
              </div>
            ))}
            {pending.length === 0 && <p className="text-sm text-ink-500">Nothing pending.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
