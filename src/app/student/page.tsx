import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { AnnouncementsBanner } from "@/components/announcements-banner";

export const metadata = { title: "Student Portal" };

export default async function StudentHome() {
  const user = await requirePortal("student");
  const student = await db.student.findUnique({
    where: { userId: user.id },
    include: { programme: true, curriculumVersion: true },
  });

  const semester = await db.semester.findFirst({ where: { isCurrent: true } });
  const registration = student && semester
    ? await db.registration.findUnique({ where: { studentId_semesterId: { studentId: student.id, semesterId: semester.id } } })
    : null;
  const invoices = student ? await db.invoice.findMany({ where: { studentId: student.id, status: { not: "PAID" } } }) : [];
  const outstanding = invoices.reduce((s, i) => s + (i.total - i.paid), 0);
  const latestResult = student
    ? await db.semesterResult.findFirst({ where: { studentId: student.id }, orderBy: { publishedAt: "desc" } })
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome back, {user.name}</h1>

      <div className="mt-4"><AnnouncementsBanner audience="STUDENTS" /></div>

      {!student ? (
        <p className="mt-4 rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          You hold the student role but have no student record yet — this normally happens automatically
          when the Registrar enrolls an accepted applicant.
        </p>
      ) : (
        <div className="mt-4 rounded-lg border border-ink-300/60 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><div className="text-xs text-ink-500">Index number</div><div className="font-mono font-semibold">{student.indexNo}</div></div>
            <div><div className="text-xs text-ink-500">Programme</div><div className="font-semibold">{student.programme.name}</div></div>
            <div><div className="text-xs text-ink-500">Status</div><div className="font-semibold">{student.status}</div></div>
          </div>
          {student.curriculumVersion && (
            <div className="mt-2 text-xs text-ink-500">Curriculum: {student.curriculumVersion.name}</div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link href="/student/registration" className="rounded-lg border border-ink-300/60 bg-white p-5 hover:border-brand-400">
          <div className="text-sm font-medium text-ink-500">Registration</div>
          <div className="mt-1 text-lg font-semibold text-ink-700">
            {registration ? `${registration.status}` : "Not registered"}
          </div>
          <div className="mt-1 text-xs text-ink-500">{semester?.label ?? "No current semester"}</div>
        </Link>
        <Link href="/student/fees" className="rounded-lg border border-ink-300/60 bg-white p-5 hover:border-brand-400">
          <div className="text-sm font-medium text-ink-500">Outstanding fees</div>
          <div className="mt-1 text-lg font-semibold text-ink-700">{formatGHS(outstanding)}</div>
          <div className="mt-1 text-xs text-ink-500">{outstanding > 0 ? "Payment required" : "All clear"}</div>
        </Link>
        <Link href="/student/results" className="rounded-lg border border-ink-300/60 bg-white p-5 hover:border-brand-400">
          <div className="text-sm font-medium text-ink-500">Cumulative average</div>
          <div className="mt-1 text-lg font-semibold text-ink-700">{latestResult ? latestResult.cumulativeAverage.toFixed(2) : "—"}</div>
          <div className="mt-1 text-xs text-ink-500">{latestResult ? latestResult.standing : "No results yet"}</div>
        </Link>
      </div>

      {student && (
        <p className="mt-6 text-sm">
          <Link href="/student/profile" className="text-brand-800 underline">View/update my profile →</Link>
        </p>
      )}

      <p className="mt-6 text-sm text-ink-500">
        The AI assistant (bottom-right) answers questions from the student handbook and examination
        regulations.
      </p>
    </div>
  );
}
