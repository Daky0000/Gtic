import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { submitAssignment } from "@/lib/actions/elearning";
import { Flash } from "@/components/flash";

export const metadata = { title: "Course E-Learning" };

export default async function StudentCourseElearningPage({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePortal("student");
  const { offeringId } = await params;
  const { error } = await searchParams;
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const offering = await db.courseOffering.findUnique({ where: { id: offeringId }, include: { course: true } });
  if (!offering) notFound();

  const registered = await db.registrationCourse.findFirst({
    where: { offeringId, registration: { studentId: student.id, status: "SUBMITTED" } },
  });
  if (!registered) return <p className="text-red-700">You are not registered for this course.</p>;

  const materials = await db.material.findMany({ where: { offeringId }, orderBy: { week: "asc" } });
  const assignments = await db.assignment.findMany({
    where: { offeringId },
    include: { submissions: { where: { studentId: student.id } } },
    orderBy: { dueAt: "asc" },
  });
  const quizzes = await db.quiz.findMany({
    where: { offeringId, published: true },
    include: { attempts: { where: { studentId: student.id } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/student/elearning" className="text-sm text-ink-500 hover:underline">← My courses</Link>
      <h1 className="mt-2 text-2xl font-bold">{offering.course.code} — {offering.course.title}</h1>
      <Flash error={error} />

      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Materials</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {materials.map((m) => (
            <li key={m.id}>
              {m.week ? `Week ${m.week}: ` : ""}{m.title}
              {m.kind === "LINK" && m.content && <> — <a href={m.content} target="_blank" rel="noreferrer" className="text-brand-800 underline">Open link</a></>}
              {m.kind === "FILE" && m.filePath && <> — <a href={`/api/files/${m.filePath}`} target="_blank" rel="noreferrer" className="text-brand-800 underline">Download</a></>}
              {m.kind === "TEXT" && m.content && <p className="text-ink-600">{m.content}</p>}
            </li>
          ))}
          {materials.length === 0 && <li className="text-ink-500">No materials posted yet.</li>}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Assignments</h2>
        {assignments.map((a) => {
          const mySubmission = a.submissions[0];
          const overdue = new Date() > a.dueAt;
          return (
            <div key={a.id} className="mt-3 rounded-md border border-ink-200 p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{a.title}</span>
                <span className="text-xs text-ink-500">Due {a.dueAt.toLocaleString()}</span>
              </div>
              <p className="mt-1 text-ink-600">{a.instructions}</p>
              {mySubmission ? (
                <div className="mt-2 rounded bg-ink-50 p-2 text-xs">
                  Submitted {mySubmission.submittedAt.toLocaleString()}
                  {mySubmission.score != null && <> — Score: {mySubmission.score}/{a.maxScore}{mySubmission.feedback && ` — ${mySubmission.feedback}`}</>}
                </div>
              ) : overdue ? (
                <p className="mt-2 text-xs text-red-700">Deadline has passed.</p>
              ) : (
                <form action={submitAssignment} className="mt-2">
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <textarea name="text" required rows={3} className="w-full rounded-md border border-ink-300 p-2 text-sm" placeholder="Your answer" />
                  <button type="submit" className="mt-1 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep">Submit</button>
                </form>
              )}
            </div>
          );
        })}
        {assignments.length === 0 && <p className="mt-2 text-sm text-ink-500">No assignments yet.</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Quizzes</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {quizzes.map((q) => (
            <li key={q.id} className="flex items-center justify-between">
              <span>{q.title}</span>
              {q.attempts[0] ? (
                <span className="text-xs text-ink-500">Score: {q.attempts[0].score?.toFixed(0)}%</span>
              ) : (
                <Link href={`/student/elearning/${offeringId}/quiz/${q.id}`} className="text-xs text-brand-800 underline">Take quiz</Link>
              )}
            </li>
          ))}
          {quizzes.length === 0 && <li className="text-ink-500">No quizzes published yet.</li>}
        </ul>
      </section>
    </div>
  );
}
