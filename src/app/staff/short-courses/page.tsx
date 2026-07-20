import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/rbac";
import { formatGHS } from "@/lib/money";
import { PageHeader, StatusChip, type ChipTone } from "@/components/ui";

export const metadata = { title: "Short Course Registrations" };

const STATUS_TONE: Record<string, ChipTone> = {
  CONFIRMED: "green",
  PENDING_PAYMENT: "amber",
  DRAFT: "neutral",
  CANCELLED: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PENDING_PAYMENT: "Awaiting payment",
  DRAFT: "In progress",
  CANCELLED: "Cancelled",
};

export default async function StaffShortCoursesPage() {
  await requireRole(
    ROLES.ADMISSIONS_OFFICER, ROLES.REGISTRAR, ROLES.MANAGEMENT, ROLES.SYSTEM_ADMIN
  );

  const courses = await db.shortCourse.findMany({
    orderBy: { name: "asc" },
    include: {
      batches: { orderBy: { startDate: "asc" } },
      registrations: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } }, batch: true },
      },
    },
  });

  return (
    <div className="scr mx-auto max-w-4xl">
      <PageHeader
        title={<>Short course <em className="text-forest">registrations.</em></>}
        lead="Every registration for the Center's vocational intensives, with payment status. Confirmed rows are paid places."
      />

      {courses.map((c) => {
        const confirmed = c.registrations.filter((r) => r.status === "CONFIRMED").length;
        return (
          <section key={c.id} className="mb-6 rounded-2xl border border-line bg-paper p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-brand-800">
                  <span className="font-mono text-xs text-faint">{c.code}</span> {c.name}
                  {!c.active && <span className="ml-2 text-xs font-normal text-faint">(inactive)</span>}
                </h2>
                <p className="mt-0.5 text-xs text-faint">
                  {c.durationWeeks} weeks ·{" "}
                  {c.batches.map((b) => `${b.label} ${b.startDate.toLocaleDateString()}`).join(" · ") || "no batches scheduled"} ·{" "}
                  {c.feePesewas > 0 ? formatGHS(c.feePesewas) : "fee not yet published"}
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="font-serif text-[22px] leading-none text-ink">{confirmed}</div>
                <div className="text-xs text-faint">confirmed</div>
              </div>
            </div>

            {c.registrations.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.06em] text-faint">
                    <tr>
                      <th className="py-1.5 pr-2">Name</th>
                      <th className="py-1.5 pr-2">Email</th>
                      <th className="py-1.5 pr-2">Phone</th>
                      <th className="py-1.5 pr-2">Batch</th>
                      <th className="py-1.5 pr-2">Registered</th>
                      <th className="py-1.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.registrations.map((r) => (
                      <tr key={r.id} className="border-t border-line-soft">
                        <td className="py-2 pr-2 font-medium">
                          <Link href={`/staff/short-courses/${r.id}`} className="text-forest hover:text-moss">
                            {r.fullName || r.user.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-2">{r.user.email}</td>
                        <td className="py-2 pr-2">{r.phone ?? "—"}</td>
                        <td className="py-2 pr-2">{r.batch?.label ?? "—"}</td>
                        <td className="py-2 pr-2 text-muted">{r.createdAt.toLocaleDateString()}</td>
                        <td className="py-2 text-right">
                          <StatusChip tone={STATUS_TONE[r.status] ?? "neutral"}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </StatusChip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-faint">No registrations yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
