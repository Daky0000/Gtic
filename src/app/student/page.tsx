import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "Student Portal" };

export default async function StudentHome() {
  const user = await requirePortal("student");
  const student = await db.student.findUnique({
    where: { userId: user.id },
    include: { programme: true, curriculumVersion: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome back, {user.name}</h1>

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
        {[
          ["Registration", "Opens with Phase 3"],
          ["Outstanding fees", "Available with Phase 5"],
          ["Published results", "Available with Phase 4"],
        ].map(([title, note]) => (
          <div key={title} className="rounded-lg border border-ink-300/60 bg-white p-5">
            <div className="text-sm font-medium text-ink-500">{title}</div>
            <div className="mt-1 text-lg font-semibold text-ink-700">—</div>
            <div className="mt-1 text-xs text-ink-500">{note}</div>
          </div>
        ))}
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
