import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  addMaterial, createAssignment, createQuiz, gradeSubmission, requestAiGradeSuggestion,
} from "@/lib/actions/elearning";

export const metadata = { title: "E-Learning" };

export default async function OfferingElearningPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortal("staff");
  const { id: offeringId } = await params;

  const offering = await db.courseOffering.findUnique({
    where: { id: offeringId },
    include: { course: true, lecturers: true },
  });
  if (!offering) notFound();
  const isAssigned = offering.lecturers.some((l) => l.staffUserId === user.id);
  if (!isAssigned && !hasRole(user, ROLES.SYSTEM_ADMIN)) return <p className="text-red-700">You are not assigned to this course.</p>;

  const materials = await db.material.findMany({ where: { offeringId }, orderBy: { week: "asc" } });
  const assignments = await db.assignment.findMany({
    where: { offeringId },
    include: { submissions: { include: { student: { include: { user: true } } } } },
    orderBy: { dueAt: "asc" },
  });
  const quizzes = await db.quiz.findMany({ where: { offeringId }, include: { _count: { select: { questions: true, attempts: true } } } });

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/staff/courses/${offeringId}`} className="text-sm text-ink-500 hover:underline">← Class list</Link>
      <h1 className="mt-2 text-2xl font-bold">{offering.course.code} — E-learning</h1>

      {/* Materials */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Materials</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {materials.map((m) => (
            <li key={m.id} className="flex justify-between border-b border-ink-100 py-1">
              <span>
                {m.week ? `Week ${m.week}: ` : ""}{m.title}
                {m.kind === "FILE" && m.filePath && (
                  <> — <a href={`/api/files/${m.filePath}`} target="_blank" rel="noreferrer" className="text-brand-800 underline">Download</a></>
                )}
              </span>
              <span className="text-xs text-ink-500">{m.kind}</span>
            </li>
          ))}
          {materials.length === 0 && <li className="text-ink-500">No materials yet.</li>}
        </ul>
        <form action={addMaterial} className="mt-4 grid gap-2 sm:grid-cols-4">
          <input type="hidden" name="offeringId" value={offeringId} />
          <input name="title" placeholder="Title" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm sm:col-span-2" />
          <input name="week" type="number" placeholder="Week" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <select name="kind" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm">
            <option value="TEXT">Text note</option>
            <option value="LINK">Link</option>
          </select>
          <input name="content" placeholder="Text or URL" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm sm:col-span-3" />
          <button type="submit" className="rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-deep">Add</button>
        </form>
      </section>

      {/* Assignments */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Assignments</h2>
        {assignments.map((a) => (
          <div key={a.id} className="mt-3 rounded-md border border-ink-200 p-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{a.title}</span>
              <span className="text-xs text-ink-500">Due {a.dueAt.toLocaleString()} · out of {a.maxScore}</span>
            </div>
            <div className="mt-2 space-y-2">
              {a.submissions.map((s) => {
                const suggestion = s.aiSuggestion as { suggestedScore: number; rationale: string } | null;
                return (
                  <div key={s.id} className="rounded bg-ink-50 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.student.user.name}</span>
                      <span>{s.score != null ? `Score: ${s.score}` : "Not graded"}</span>
                    </div>
                    {s.text && <p className="mt-1 text-ink-600">{s.text.slice(0, 200)}</p>}
                    {suggestion && (
                      <div className="mt-1 rounded bg-brand-50 p-2 text-brand-900">
                        AI suggests {suggestion.suggestedScore}/{a.maxScore}: {suggestion.rationale}
                      </div>
                    )}
                    {s.score == null && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <form action={requestAiGradeSuggestion}>
                          <input type="hidden" name="submissionId" value={s.id} />
                          <button type="submit" className="rounded border border-brand-300 bg-brand-50 px-2 py-1 text-brand-800 hover:bg-brand-100">Get AI suggestion</button>
                        </form>
                        <form action={gradeSubmission} className="flex items-center gap-1">
                          <input type="hidden" name="submissionId" value={s.id} />
                          <input type="hidden" name="offeringId" value={offeringId} />
                          <input name="score" type="number" step="0.5" defaultValue={suggestion?.suggestedScore ?? ""} placeholder="Score" required className="w-16 rounded border border-ink-300 px-1 py-0.5" />
                          <input name="feedback" placeholder="Feedback" className="w-32 rounded border border-ink-300 px-1 py-0.5" />
                          <button type="submit" className="rounded bg-brand-800 px-2 py-1 text-white hover:bg-forest-deep">Save grade</button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
              {a.submissions.length === 0 && <p className="text-xs text-ink-500">No submissions yet.</p>}
            </div>
          </div>
        ))}
        <form action={createAssignment} className="mt-4 grid gap-2 sm:grid-cols-4">
          <input type="hidden" name="offeringId" value={offeringId} />
          <input name="title" placeholder="Title" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm sm:col-span-2" />
          <input name="dueAt" type="datetime-local" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <input name="maxScore" type="number" defaultValue={100} className="rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <textarea name="instructions" placeholder="Instructions" required className="rounded-md border border-ink-300 px-2 py-1.5 text-sm sm:col-span-4" />
          <button type="submit" className="rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-deep sm:col-span-1">Create</button>
        </form>
      </section>

      {/* Quizzes */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Quizzes</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {quizzes.map((q) => (
            <li key={q.id} className="flex justify-between border-b border-ink-100 py-1">
              <Link href={`/staff/courses/${offeringId}/quizzes/${q.id}`} className="text-brand-800 hover:underline">{q.title}</Link>
              <span className="text-xs text-ink-500">{q._count.questions} question(s) · {q.published ? "Published" : "Draft"} · {q._count.attempts} attempt(s)</span>
            </li>
          ))}
          {quizzes.length === 0 && <li className="text-ink-500">No quizzes yet.</li>}
        </ul>
        <form action={createQuiz} className="mt-4 flex gap-2">
          <input type="hidden" name="offeringId" value={offeringId} />
          <input name="title" placeholder="Quiz title" required className="flex-1 rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <input name="durationMin" type="number" placeholder="Minutes" className="w-24 rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <button type="submit" className="rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-deep">Create quiz</button>
        </form>
      </section>
    </div>
  );
}
