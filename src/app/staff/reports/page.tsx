import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { askAnalyticsQuestionAction } from "@/lib/actions/analytics";

export const metadata = { title: "Reports & Analytics" };

export default async function ReportsPage() {
  const user = await requirePortal("staff");

  const [totalStudents, activeStudents, cycle, invoices, gradeEntries] = await Promise.all([
    db.student.count(),
    db.student.count({ where: { status: "ACTIVE" } }),
    db.admissionCycle.findFirst({ where: { status: "OPEN" } }),
    db.invoice.findMany({ where: { kind: "TUITION" } }),
    db.gradeEntry.findMany({ where: { gradeSheet: { status: "PUBLISHED" } } }),
  ]);
  const applications = cycle ? await db.application.count({ where: { cycleId: cycle.id } }) : 0;
  const billed = invoices.reduce((s, i) => s + i.total, 0);
  const collected = invoices.reduce((s, i) => s + i.paid, 0);
  const passed = gradeEntries.filter((e) => (e.total ?? 0) >= 40).length;

  const conversation = await db.aIConversation.findFirst({
    where: { userId: user.id, feature: "analytics" },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } },
  });
  const recentQA = conversation ? [...conversation.messages].reverse() : [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Reports &amp; analytics</h1>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-paper p-4"><div className="text-xs text-ink-500">Students (active/total)</div><div className="text-lg font-bold">{activeStudents} / {totalStudents}</div></div>
        <div className="rounded-2xl border border-line bg-paper p-4"><div className="text-xs text-ink-500">Applications (open cycle)</div><div className="text-lg font-bold">{applications}</div></div>
        <div className="rounded-2xl border border-line bg-paper p-4"><div className="text-xs text-ink-500">Fees collected</div><div className="text-lg font-bold">{formatGHS(collected)} / {formatGHS(billed)}</div></div>
        <div className="rounded-2xl border border-line bg-paper p-4"><div className="text-xs text-ink-500">Pass rate</div><div className="text-lg font-bold">{gradeEntries.length > 0 ? Math.round((passed / gradeEntries.length) * 100) : 0}%</div></div>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Ask the AI analytics assistant</h2>
        <p className="mt-1 text-xs text-ink-500">
          Answers are computed live from safe, read-only queries — never guessed. Try &ldquo;How many
          applications are open right now?&rdquo; or &ldquo;What&apos;s the pass rate?&rdquo;
        </p>
        <form action={askAnalyticsQuestionAction} className="mt-3 flex gap-2">
          <input name="question" placeholder="Ask a question…" required className="flex-1 rounded-md border border-ink-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">Ask</button>
        </form>

        <div className="mt-4 space-y-2">
          {recentQA.map((m) => (
            <div key={m.id} className={m.role === "USER" ? "text-sm font-medium text-ink-700" : "rounded-md bg-brand-50 p-2 text-sm text-brand-900"}>
              {m.role === "USER" ? `Q: ${m.content}` : m.content}
            </div>
          ))}
          {recentQA.length === 0 && <p className="text-sm text-ink-500">No questions asked yet.</p>}
        </div>
      </section>
    </div>
  );
}
