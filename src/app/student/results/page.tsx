import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { classOfDegree } from "@/lib/grading";

export const metadata = { title: "Results" };

export default async function ResultsPage() {
  const user = await requirePortal("student");
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const results = await db.semesterResult.findMany({
    where: { studentId: student.id },
    orderBy: { publishedAt: "asc" },
    include: { semester: true },
  });

  const publishedEntries = await db.gradeEntry.findMany({
    where: { studentId: student.id, gradeSheet: { status: "PUBLISHED" } },
    include: { gradeSheet: { include: { offering: { include: { course: true, semester: true } } } } },
  });

  const latest = results.at(-1);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">My results</h1>

      {latest && (
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-brand-200 bg-brand-50 p-5 sm:grid-cols-4">
          <div><div className="text-xs text-brand-700">Cumulative average</div><div className="text-lg font-bold text-brand-900">{latest.cumulativeAverage.toFixed(2)}</div></div>
          <div><div className="text-xs text-brand-700">Class of degree (to date)</div><div className="text-lg font-bold text-brand-900">{classOfDegree(latest.cumulativeAverage)}</div></div>
          <div><div className="text-xs text-brand-700">Standing</div><div className="text-lg font-bold text-brand-900">{latest.standing}</div></div>
          <div><div className="text-xs text-brand-700">Credits earned</div><div className="text-lg font-bold text-brand-900">{results.reduce((s, r) => s + r.creditsEarned, 0)}</div></div>
        </div>
      )}

      {results.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">No results have been published yet.</p>
      ) : (
        results.map((r) => (
          <div key={r.id} className="mt-6 rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-800">{r.semester.label}</h2>
              <span className="text-sm text-ink-500">Semester average: {r.semesterAverage.toFixed(2)}</span>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-500">
                <tr><th className="py-1">Course</th><th className="py-1">Total</th><th className="py-1">Grade</th></tr>
              </thead>
              <tbody>
                {publishedEntries
                  .filter((e) => e.gradeSheet.offering.semesterId === r.semesterId)
                  .map((e) => (
                    <tr key={e.id} className="border-t border-ink-100">
                      <td className="py-1">{e.gradeSheet.offering.course.code} — {e.gradeSheet.offering.course.title}</td>
                      <td className="py-1 font-mono">{e.total?.toFixed(1)}</td>
                      <td className="py-1 font-mono">{e.grade}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
