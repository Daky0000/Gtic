import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "Class List" };

export default async function ClassListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortal("staff");
  const { id } = await params;

  const offering = await db.courseOffering.findUnique({
    where: { id },
    include: {
      course: true,
      semester: true,
      lecturers: { include: { staffUser: true } },
      registrationCourses: {
        include: { registration: { include: { student: { include: { user: true, programme: true } } } } },
      },
    },
  });
  if (!offering) notFound();

  const isAssigned = offering.lecturers.some((l) => l.staffUserId === user.id);
  if (!isAssigned && !hasRole(user, ROLES.SYSTEM_ADMIN, ROLES.HOD, ROLES.DEAN, ROLES.REGISTRAR)) {
    return <p className="text-red-700">You are not assigned to this course.</p>;
  }

  const roster = offering.registrationCourses
    .filter((rc) => rc.registration.status === "SUBMITTED")
    .map((rc) => rc.registration.student)
    .sort((a, b) => a.user.name.localeCompare(b.user.name));

  return (
    <div>
      <Link href="/staff/courses" className="text-sm text-ink-500 hover:underline">← My courses</Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{offering.course.code} — {offering.course.title}</h1>
          <p className="text-sm text-ink-500">{offering.semester.label}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/staff/courses/${offering.id}/elearning`}
            className="rounded-md border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
          >
            E-learning
          </Link>
          <Link
            href={`/staff/courses/${offering.id}/grading`}
            className="rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-deep"
          >
            Grading
          </Link>
          <a
            href={`/api/staff/courses/${offering.id}/roster.csv`}
            className="rounded-md border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">Index No.</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Programme</th></tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id} className="border-t border-ink-100">
                <td className="px-4 py-2 font-mono text-xs">{s.indexNo}</td>
                <td className="px-4 py-2">{s.user.name}</td>
                <td className="px-4 py-2">{s.programme.name}</td>
              </tr>
            ))}
            {roster.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-ink-500">No students registered yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
