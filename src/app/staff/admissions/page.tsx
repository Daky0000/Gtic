import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_COLOR, APPLICATION_STATUS_LABEL } from "@/lib/status-labels";
import type { ApplicationStatus } from "@prisma/client";

export const metadata = { title: "Admissions Review" };

const QUEUE_STATUSES: ApplicationStatus[] = [
  "SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "RECOMMENDED", "OFFER_ISSUED", "ACCEPTED", "REJECTED", "DECLINED",
];

export default async function AdmissionsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePortal("staff");
  const { status } = await searchParams;
  const filter = status && QUEUE_STATUSES.includes(status as ApplicationStatus) ? (status as ApplicationStatus) : undefined;

  const applications = await db.application.findMany({
    where: { status: filter ? filter : { in: QUEUE_STATUSES } },
    include: { user: true, choices: { include: { programme: true }, orderBy: { rank: "asc" } } },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });

  const cycle = await db.admissionCycle.findFirst({ where: { status: "OPEN" } });

  return (
    <div>
      <h1 className="text-2xl font-bold">Admissions review</h1>
      <p className="mt-1 text-sm text-ink-500">
        {cycle ? `Current cycle: ${cycle.name}` : "No open admission cycle"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/staff/admissions" className={`rounded-full px-3 py-1 text-xs font-medium ${!filter ? "bg-brand-800 text-white" : "bg-ink-100 text-ink-700"}`}>
          All
        </Link>
        {QUEUE_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/staff/admissions?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s ? "bg-brand-800 text-white" : "bg-ink-100 text-ink-700"}`}
          >
            {APPLICATION_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-ink-300/60 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Applicant</th>
              <th className="px-4 py-2">First choice</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id} className="border-t border-ink-100">
                <td className="px-4 py-2 font-mono text-xs">{app.refNo}</td>
                <td className="px-4 py-2">{[app.firstName, app.surname].filter(Boolean).join(" ") || app.user.name}</td>
                <td className="px-4 py-2">{app.choices[0]?.programme.name ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${APPLICATION_STATUS_COLOR[app.status]}`}>
                    {APPLICATION_STATUS_LABEL[app.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/staff/admissions/${app.id}`} className="text-brand-800 hover:underline">
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-500">No applications in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
