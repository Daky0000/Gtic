import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { submitQuizAttempt } from "@/lib/actions/elearning";

export const metadata = { title: "Quiz" };

export default async function TakeQuizPage({ params }: { params: Promise<{ offeringId: string; quizId: string }> }) {
  const user = await requirePortal("student");
  const { offeringId, quizId } = await params;
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { ord: "asc" } }, attempts: { where: { studentId: student.id } } },
  });
  if (!quiz || !quiz.published) notFound();

  const existing = quiz.attempts[0];

  if (existing) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-bold">{quiz.title}</h1>
        <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-6">
          <div className="text-3xl font-bold text-brand-900">{existing.score?.toFixed(0)}%</div>
          <p className="mt-1 text-sm text-brand-800">Submitted {existing.submittedAt?.toLocaleString()}</p>
        </div>
        <Link href={`/student/elearning/${offeringId}`} className="mt-4 inline-block text-sm text-ink-500 hover:underline">← Back to course</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">{quiz.title}</h1>
      {quiz.durationMin && <p className="text-sm text-ink-500">Suggested duration: {quiz.durationMin} minutes</p>}

      <form action={submitQuizAttempt} className="mt-6 space-y-6">
        <input type="hidden" name="quizId" value={quiz.id} />
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-ink-300/60 bg-white p-4">
            <div className="font-medium">{i + 1}. {q.prompt}</div>
            <div className="mt-2 space-y-1">
              {(q.options as string[]).map((o, oi) => (
                <label key={oi} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={`q_${q.id}`} value={oi} required />
                  {o}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button type="submit" className="rounded-md bg-brand-800 px-5 py-2.5 font-medium text-white hover:bg-brand-700">
          Submit quiz
        </button>
      </form>
    </div>
  );
}
