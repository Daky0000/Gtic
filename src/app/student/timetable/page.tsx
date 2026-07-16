import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "My Timetable" };

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function StudentTimetablePage() {
  const user = await requirePortal("student");
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const semester = await db.semester.findFirst({ where: { isCurrent: true } });
  const registration = semester
    ? await db.registration.findUnique({
        where: { studentId_semesterId: { studentId: student.id, semesterId: semester.id } },
        include: { courses: { include: { offering: { include: { course: true, sessions: { include: { venue: true } } } } } } },
      })
    : null;

  const sessions = (registration?.courses ?? [])
    .flatMap((rc) => rc.offering.sessions.map((s) => ({ ...s, courseCode: rc.offering.course.code })))
    .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">My timetable</h1>
      <p className="mt-1 text-sm text-ink-500">{semester?.label}</p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">Day</th><th className="px-4 py-2">Time</th><th className="px-4 py-2">Course</th><th className="px-4 py-2">Venue</th></tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-ink-100">
                <td className="px-4 py-2">{DAY_NAMES[s.dayOfWeek ?? 0]}</td>
                <td className="px-4 py-2">{s.startTime}–{s.endTime}</td>
                <td className="px-4 py-2">{s.courseCode}</td>
                <td className="px-4 py-2">{s.venue?.name}</td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No sessions scheduled for your registered courses yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
