import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AnnouncementsBanner } from "@/components/announcements-banner";

export const metadata = { title: "Staff Portal" };

export default async function StaffHome() {
  const user = await requirePortal("staff");

  const [pendingAdmissions, pendingApprovals, pendingDocs] = await Promise.all([
    db.application.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    db.gradeSheet.count({ where: { status: { in: ["SUBMITTED", "HOD_APPROVED", "DEAN_APPROVED", "VALIDATED"] } } }),
    db.documentRequest.count({ where: { status: { in: ["QUEUED", "PROCESSING"] } } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Staff dashboard</h1>
      <p className="mt-2 text-ink-500">
        Signed in as {user.email} · roles: {user.roles.join(", ") || "none"}
      </p>

      <div className="mt-4"><AnnouncementsBanner audience="STAFF" /></div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link href="/staff/admissions" className="rounded-lg border border-ink-300/60 bg-white p-5 hover:border-brand-400">
          <div className="text-sm font-medium text-ink-500">Admissions review</div>
          <div className="mt-1 text-lg font-semibold text-ink-700">{pendingAdmissions}</div>
          <div className="mt-1 text-xs text-ink-500">applications awaiting review</div>
        </Link>
        <Link href="/staff/approvals" className="rounded-lg border border-ink-300/60 bg-white p-5 hover:border-brand-400">
          <div className="text-sm font-medium text-ink-500">Pending approvals</div>
          <div className="mt-1 text-lg font-semibold text-ink-700">{pendingApprovals}</div>
          <div className="mt-1 text-xs text-ink-500">grade sheets in the approval chain</div>
        </Link>
        <Link href="/staff/documents" className="rounded-lg border border-ink-300/60 bg-white p-5 hover:border-brand-400">
          <div className="text-sm font-medium text-ink-500">Document requests</div>
          <div className="mt-1 text-lg font-semibold text-ink-700">{pendingDocs}</div>
          <div className="mt-1 text-xs text-ink-500">awaiting fulfilment</div>
        </Link>
      </div>
    </div>
  );
}
