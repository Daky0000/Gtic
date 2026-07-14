import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "My Courses" };

export default async function MyCoursesPage() {
  const user = await requirePortal("staff");

  const offerings = await db.courseOffering.findMany({
    where: { semester: { isCurrent: true }, lecturers: { some: { staffUserId: user.id } } },
    include: { course: true, semester: true, _count: { select: { registrationCourses: true } } },
    orderBy: { course: { code: "asc" } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">My courses</h1>
      <p className="mt-1 text-sm text-ink-500">Courses assigned to you for the current semester.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {offerings.map((o) => (
          <Link
            key={o.id}
            href={`/staff/courses/${o.id}`}
            className="rounded-lg border border-ink-300/60 bg-white p-5 hover:border-brand-400"
          >
            <div className="font-semibold text-brand-800">{o.course.code}</div>
            <div className="text-sm text-ink-700">{o.course.title}</div>
            <div className="mt-2 text-xs text-ink-500">
              {o._count.registrationCourses} student(s) registered · {o.course.credits} credits
            </div>
          </Link>
        ))}
        {offerings.length === 0 && <p className="text-sm text-ink-500">No courses assigned to you this semester.</p>}
      </div>
    </div>
  );
}
