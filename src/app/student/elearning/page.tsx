import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "E-Learning" };

export default async function StudentElearningIndex() {
  const user = await requirePortal("student");
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const semester = await db.semester.findFirst({ where: { isCurrent: true } });
  const registration = semester
    ? await db.registration.findUnique({
        where: { studentId_semesterId: { studentId: student.id, semesterId: semester.id } },
        include: { courses: { include: { offering: { include: { course: true } } } } },
      })
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">E-learning</h1>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {registration?.courses.map((rc) => (
          <Link
            key={rc.id}
            href={`/student/elearning/${rc.offeringId}`}
            className="rounded-2xl border border-line bg-paper p-5 hover:border-brand-400"
          >
            <div className="font-semibold text-brand-800">{rc.offering.course.code}</div>
            <div className="text-sm text-ink-700">{rc.offering.course.title}</div>
          </Link>
        ))}
        {!registration && <p className="text-sm text-ink-500">You have no registered courses this semester.</p>}
      </div>
    </div>
  );
}
