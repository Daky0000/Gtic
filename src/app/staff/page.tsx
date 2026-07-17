import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AnnouncementsBanner } from "@/components/announcements-banner";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Staff Portal" };

export default async function StaffHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePortal("staff");
  const { error } = await searchParams;

  const [pendingAdmissions, pendingApprovals, pendingDocs] = await Promise.all([
    db.application.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    db.gradeSheet.count({ where: { status: { in: ["SUBMITTED", "HOD_APPROVED", "DEAN_APPROVED", "VALIDATED"] } } }),
    db.documentRequest.count({ where: { status: { in: ["QUEUED", "PROCESSING"] } } }),
  ]);

  const firstName = user.name.split(/\s+/)[0] || user.name;

  return (
    <div className="scr">
      <PageHeader
        title={<>Welcome, <em className="text-forest">{firstName}.</em></>}
        lead={`Roles: ${user.roles.join(", ") || "none"} · ${user.email}`}
      />

      <Flash error={error} />

      <div className="mb-6">
        <AnnouncementsBanner audience="STAFF" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          href="/staff/admissions"
          label="Admissions review"
          value={pendingAdmissions}
          sub="applications awaiting review"
          tint="#E7B54A"
        />
        <MetricCard
          href="/staff/approvals"
          label="Pending approvals"
          value={pendingApprovals}
          sub="grade sheets in the approval chain"
          tint="#6FA9C4"
        />
        <MetricCard
          href="/staff/documents"
          label="Document requests"
          value={pendingDocs}
          sub="awaiting fulfilment"
          tint="#8AA84B"
        />
      </div>
    </div>
  );
}

function MetricCard({
  href,
  label,
  value,
  sub,
  tint,
}: {
  href: string;
  label: string;
  value: number;
  sub: string;
  tint: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-forest"
    >
      <div className="mb-4 h-1.5 w-[30px] rounded-full" style={{ background: tint }} />
      <div className="font-serif text-[34px] leading-none text-ink">{value}</div>
      <div className="mt-2 text-[13px] text-ink">{label}</div>
      <div className="mt-0.5 text-xs text-faint">{sub}</div>
    </Link>
  );
}
