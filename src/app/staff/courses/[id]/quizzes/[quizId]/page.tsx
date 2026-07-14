import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { addQuizQuestionManual, addQuizQuestionsFromAi, publishQuiz } from "@/lib/actions/elearning";

export const metadata = { title: "Quiz Builder" };

export default async function QuizBuilderPage({ params }: { params: Promise<{ id: string; quizId: string }> }) {
  const user = await requirePortal("staff");
  const { id: offeringId, quizId } = await params;

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: { offering: { include: { lecturers: true } }, questions: { orderBy: { ord: "asc" } }, attempts: true },
  });
  if (!quiz) notFound();
  const isAssigned = quiz.offering.lecturers.some((l) => l.staffUserId === user.id);
  if (!isAssigned && !hasRole(user, ROLES.SYSTEM_ADMIN)) return <p className="text-red-700">You are not assigned to this course.</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/staff/courses/${offeringId}/elearning`} className="text-sm text-ink-500 hover:underline">← E-learning</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{quiz.title}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${quiz.published ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-700"}`}>
          {quiz.published ? "Published" : "Draft"}
        </span>
      </div>
      <p className="text-sm text-ink-500">{quiz.attempts.length} attempt(s) so far</p>

      <div className="mt-6 space-y-3">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-ink-300/60 bg-white p-4 text-sm">
            <div className="font-medium">{i + 1}. {q.prompt}</div>
            <ol className="mt-2 list-[upper-alpha] space-y-1 pl-5">
              {(q.options as string[]).map((o, oi) => (
                <li key={oi} className={oi === q.correctIndex ? "font-semibold text-brand-800" : ""}>{o}</li>
              ))}
            </ol>
          </div>
        ))}
        {quiz.questions.length === 0 && <p className="text-sm text-ink-500">No questions yet.</p>}
      </div>

      {!quiz.published && (
        <>
          <form action={addQuizQuestionsFromAi} className="mt-6">
            <input type="hidden" name="quizId" value={quiz.id} />
            <button type="submit" className="rounded-md border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100">
              Draft 3 questions with AI
            </button>
            <span className="ml-2 text-xs text-ink-500">You review and can edit before publishing.</span>
          </form>

          <form action={addQuizQuestionManual} className="mt-4 space-y-2 rounded-lg border border-ink-300/60 bg-white p-4">
            <input type="hidden" name="quizId" value={quiz.id} />
            <h3 className="text-sm font-semibold text-ink-700">Add a question manually</h3>
            <input name="prompt" placeholder="Question" required className="w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <input key={i} name={`option_${i}`} placeholder={`Option ${i}`} required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
              ))}
            </div>
            <select name="correctIndex" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm">
              <option value="0">Option 1 is correct</option>
              <option value="1">Option 2 is correct</option>
              <option value="2">Option 3 is correct</option>
              <option value="3">Option 4 is correct</option>
            </select>
            <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Add question</button>
          </form>

          <form action={publishQuiz} className="mt-4">
            <input type="hidden" name="quizId" value={quiz.id} />
            <button type="submit" className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Publish quiz
            </button>
          </form>
        </>
      )}
    </div>
  );
}
