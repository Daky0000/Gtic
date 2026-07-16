import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { enrollAcceptedApplicant } from "@/lib/actions/sis";
import { Flash } from "@/components/flash";

export const metadata = { title: "Enrollment" };

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePortal("staff");
  const { error } = await searchParams;

  const accepted = await db.application.findMany({
    where: { status: "ACCEPTED" },
    include: { user: true, offer: { include: { programme: true } } },
    orderBy: { decidedAt: "asc" },
  });
  const recentlyEnrolled = await db.student.findMany({
    where: { applicationId: { not: null } },
    include: { user: true, programme: true },
    orderBy: { admittedAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Enrollment</h1>
      <Flash error={error} />
      <p className="mt-1 text-sm text-ink-500">
        Convert accepted applicants into students — index number, programme and curriculum are carried
        over automatically.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Applicant</th>
              <th className="px-4 py-2">Programme</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {accepted.map((app) => (
              <tr key={app.id} className="border-t border-ink-100">
                <td className="px-4 py-2 font-mono text-xs">{app.refNo}</td>
                <td className="px-4 py-2">{[app.firstName, app.surname].filter(Boolean).join(" ") || app.user.name}</td>
                <td className="px-4 py-2">{app.offer?.programme.name}</td>
                <td className="px-4 py-2 text-right">
                  <form action={enrollAcceptedApplicant}>
                    <input type="hidden" name="applicationId" value={app.id} />
                    <button type="submit" className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep">
                      Enroll as student
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {accepted.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No accepted applicants awaiting enrollment.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 font-semibold text-ink-700">Recently enrolled</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">Index No.</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Programme</th></tr>
          </thead>
          <tbody>
            {recentlyEnrolled.map((s) => (
              <tr key={s.id} className="border-t border-ink-100">
                <td className="px-4 py-2 font-mono text-xs">{s.indexNo}</td>
                <td className="px-4 py-2">{s.user.name}</td>
                <td className="px-4 py-2">{s.programme.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
