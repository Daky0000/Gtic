import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { parseFields, type FormFieldDef } from "@/lib/forms";

export const metadata = { title: "Form Responses" };

type Answers = Record<string, string | string[]>;

const answerText = (a: string | string[] | undefined) =>
  a === undefined ? "—" : Array.isArray(a) ? a.join(", ") : a;

/** Option → count for a choice field across all responses. */
function optionCounts(field: FormFieldDef, responses: Answers[]): [string, number][] {
  const counts = new Map<string, number>((field.options ?? []).map((o) => [o, 0]));
  for (const r of responses) {
    const a = r[field.id];
    const picked = Array.isArray(a) ? a : a ? [a] : [];
    for (const p of picked) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()];
}

export default async function FormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDeveloperConsole();
  const { id } = await params;

  const form = await db.formDef.findUnique({
    where: { id },
    include: {
      responses: {
        orderBy: { submittedAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!form) notFound();
  const fields = parseFields(form.fields);
  const answerSets = form.responses.map((r) => (r.answers ?? {}) as Answers);
  const total = form.responses.length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/forms/${form.id}`} className="text-xs text-ink-500 hover:text-forest">← Back to form</Link>
      <h1 className="text-2xl font-bold">{form.title} — responses</h1>
      <p className="mt-1 text-sm text-ink-500">{total} response(s).</p>

      {/* Results summary */}
      {total > 0 && fields.some((f) => f.type === "SELECT" || f.type === "CHECKBOX" || f.type === "NUMBER") && (
        <section className="mt-5 rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Results</h2>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            {fields.map((f) => {
              if (f.type === "SELECT" || f.type === "CHECKBOX") {
                const counts = optionCounts(f, answerSets);
                const max = Math.max(1, ...counts.map(([, n]) => n));
                return (
                  <div key={f.id}>
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="mt-2 space-y-1.5">
                      {counts.map(([option, n]) => (
                        <div key={option} className="flex items-center gap-2 text-xs">
                          <span className="w-28 truncate text-ink-600" title={option}>{option}</span>
                          <span className="h-3 rounded-sm bg-forest/70" style={{ width: `${(n / max) * 140}px`, minWidth: n > 0 ? 4 : 0 }} />
                          <span className="text-ink-500">{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              if (f.type === "NUMBER") {
                const nums = answerSets
                  .map((r) => Number(r[f.id]))
                  .filter((n) => Number.isFinite(n));
                if (nums.length === 0) return null;
                const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
                return (
                  <div key={f.id}>
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="mt-1 text-xs text-ink-600">
                      {nums.length} answer(s) · average {avg.toFixed(2)} · min {Math.min(...nums)} · max {Math.max(...nums)}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </section>
      )}

      {/* Individual responses */}
      <section className="mt-5 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-[11px] uppercase tracking-[0.06em] text-ink-500">
            <tr>
              <th className="px-3 py-2">Respondent</th>
              {fields.map((f) => (
                <th key={f.id} className="max-w-44 px-3 py-2">{f.label}</th>
              ))}
              <th className="px-3 py-2 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {form.responses.map((r) => {
              const a = (r.answers ?? {}) as Answers;
              return (
                <tr key={r.id} className="border-t border-line-soft align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.user?.name ?? r.respondentName ?? "Anonymous"}</div>
                    <div className="text-xs text-ink-500">{r.user?.email ?? r.respondentEmail ?? ""}</div>
                  </td>
                  {fields.map((f) => (
                    <td key={f.id} className="max-w-44 px-3 py-2">
                      <div className="line-clamp-4 whitespace-pre-wrap break-words text-[13px]">
                        {answerText(a[f.id])}
                      </div>
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-ink-500">
                    {r.submittedAt.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {total === 0 && (
              <tr>
                <td colSpan={fields.length + 2} className="px-3 py-8 text-center text-ink-500">
                  No responses yet — share the public link to start collecting.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
