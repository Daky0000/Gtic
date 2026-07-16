import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { saveRegistration } from "@/lib/actions/registration";

export const metadata = { title: "Course Registration" };

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePortal("student");
  const { error } = await searchParams;

  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const semester = await db.semester.findFirst({ where: { isCurrent: true }, include: { academicYear: true } });
  if (!semester) {
    return <p className="text-ink-500">No current semester is configured.</p>;
  }

  const now = new Date();
  const windows = await db.window.findMany({
    where: { semesterId: semester.id, type: { in: ["REGISTRATION", "ADD_DROP"] } },
  });
  const anyOpen = windows.some((w) => now >= w.opensAt && now <= w.closesAt);

  const offerings = student.curriculumVersionId
    ? await db.courseOffering.findMany({
        where: {
          semesterId: semester.id,
          course: { curriculumCourses: { some: { curriculumId: student.curriculumVersionId } } },
        },
        include: {
          course: true,
          lecturers: { include: { staffUser: true } },
          _count: { select: { registrationCourses: true } },
        },
      })
    : [];

  const registration = await db.registration.findUnique({
    where: { studentId_semesterId: { studentId: student.id, semesterId: semester.id } },
    include: { courses: true },
  });
  const registeredIds = new Set(registration?.courses.map((c) => c.offeringId));

  const curriculum = student.curriculumVersionId
    ? await db.curriculumVersion.findUnique({ where: { id: student.curriculumVersionId } })
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Course registration</h1>
      <p className="mt-1 text-sm text-ink-500">{semester.label}</p>

      <div className={`mt-4 rounded-md p-3 text-sm ${anyOpen ? "bg-brand-50 text-brand-900" : "bg-ink-100 text-ink-700"}`}>
        {anyOpen ? "Registration or add/drop is currently open." : "Registration and add/drop are both closed."}
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {curriculum && (
        <p className="mt-4 text-xs text-ink-500">
          Your curriculum requires {curriculum.minCredits}–{curriculum.maxCredits} credit hours per semester.
        </p>
      )}

      <form action={saveRegistration} className="mt-4 space-y-2">
        {offerings.map((o) => (
          <label key={o.id} className="flex items-center justify-between rounded-md border border-line bg-paper p-3 text-sm">
            <span className="flex items-center gap-3">
              <input
                type="checkbox" name="offeringId" value={o.id}
                defaultChecked={registeredIds.has(o.id)}
                disabled={!anyOpen}
                className="h-4 w-4"
              />
              <span>
                <span className="font-medium">{o.course.code}</span> — {o.course.title}
                <span className="ml-2 text-xs text-ink-500">
                  {o.lecturers.map((l) => l.staffUser.name).join(", ")}
                </span>
              </span>
            </span>
            <span className="text-xs text-ink-500">{o.course.credits} cr · {o._count.registrationCourses} registered</span>
          </label>
        ))}
        {offerings.length === 0 && (
          <p className="text-sm text-ink-500">No course offerings match your curriculum this semester yet.</p>
        )}
        {anyOpen && offerings.length > 0 && (
          <button type="submit" className="mt-3 rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep">
            Save registration
          </button>
        )}
      </form>

      {registration && registration.status === "SUBMITTED" && (
        <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          Registration on file for {semester.label} — {registration.courses.length} course(s).
        </div>
      )}
    </div>
  );
}
