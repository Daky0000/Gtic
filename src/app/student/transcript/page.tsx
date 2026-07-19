import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { generateTranscript } from "@/lib/actions/exams";
import { classOfDegree } from "@/lib/grading";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Transcript" };

export default async function TranscriptPage() {
  const user = await requirePortal("student");
  const student = await db.student.findUnique({
    where: { userId: user.id },
    include: { programme: true },
  });
  if (!student) redirect("/student");

  const results = await db.semesterResult.findMany({
    where: { studentId: student.id },
    orderBy: { publishedAt: "asc" },
    include: { semester: true },
  });
  const entries = await db.gradeEntry.findMany({
    where: { studentId: student.id, gradeSheet: { status: "PUBLISHED" } },
    include: { gradeSheet: { include: { offering: { include: { course: true, semester: true } } } } },
  });
  const latestIssued = await db.issuedDocument.findFirst({
    where: { userId: user.id, type: "TRANSCRIPT" },
    orderBy: { createdAt: "desc" },
  });
  const latestResult = results.at(-1);
  const totalCreditsEarned = results.reduce((s, r) => s + r.creditsEarned, 0);
  const institution = await db.institution.findFirst();
  const institutionName = institution?.name ?? "SYDA — Green Energy & Innovation Center";

  return (
    <div className="scr mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={<>My <em className="text-forest">transcript.</em></>}
          lead="A live view of your academic record. Generate a verifiable copy any time — each carries a code anyone can check on the public verification page."
        />
        <form action={generateTranscript}>
          <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
            Generate verifiable transcript
          </button>
        </form>
      </div>

      {latestIssued && (
        <div className="mt-3 rounded-[11px] bg-[#eaf0ea] p-3 text-sm text-forest">
          Last generated {latestIssued.createdAt.toLocaleString()} · code{" "}
          <Link href={`/verify/${latestIssued.code}`} className="font-mono underline">{latestIssued.code}</Link>
        </div>
      )}

      <div className="mt-6 rounded-lg border-2 border-brand-800 bg-white p-8 print:border-none">
        <div className="border-b border-ink-300/60 pb-3">
          <div className="text-lg font-bold text-brand-800">{institutionName}</div>
          <div className="text-xs text-ink-500">Official Training Transcript</div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-ink-500">Name</dt><dd className="font-medium">{user.name}</dd></div>
          <div><dt className="text-ink-500">Index number</dt><dd className="font-mono font-medium">{student.indexNo}</dd></div>
          <div><dt className="text-ink-500">Programme</dt><dd className="font-medium">{student.programme.name}</dd></div>
          <div><dt className="text-ink-500">Class (to date)</dt><dd className="font-medium">{latestResult ? classOfDegree(latestResult.cumulativeAverage) : "—"}</dd></div>
        </dl>

        {results.map((r) => {
          const rows = entries.filter((e) => e.gradeSheet.offering.semesterId === r.semesterId);
          return (
            <div key={r.id} className="mt-5">
              <h3 className="text-sm font-semibold text-brand-800">{r.semester.label}</h3>
              <table className="mt-1 w-full text-left text-xs">
                <thead className="text-[10px] uppercase text-ink-500">
                  <tr>
                    <th className="py-1">Code</th>
                    <th className="py-1">Course</th>
                    <th className="py-1 text-right">Credits</th>
                    <th className="py-1 text-right">Total</th>
                    <th className="py-1 text-right">Grade</th>
                    <th className="py-1 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t border-ink-100">
                      <td className="py-1 font-mono">{e.gradeSheet.offering.course.code}</td>
                      <td className="py-1">{e.gradeSheet.offering.course.title}</td>
                      <td className="py-1 text-right font-mono">{e.gradeSheet.offering.course.credits}</td>
                      <td className="py-1 text-right font-mono">{e.total?.toFixed(1)}</td>
                      <td className="py-1 text-right font-mono">{e.grade}</td>
                      <td className="py-1 text-right font-mono">{e.gradePoint?.toFixed(1) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-1 text-right text-xs text-ink-500">
                Credits earned {r.creditsEarned}/{r.creditsTaken} · Semester average {r.semesterAverage.toFixed(2)} · Cumulative {r.cumulativeAverage.toFixed(2)}
              </div>
            </div>
          );
        })}
        {results.length === 0 && <p className="mt-4 text-sm text-ink-500">No published results yet.</p>}

        {results.length > 0 && (
          <div className="mt-6 border-t border-ink-300/60 pt-3 text-right text-sm font-semibold text-brand-800">
            Total credits earned: {totalCreditsEarned}
            {latestResult && <> · Final cumulative average: {latestResult.cumulativeAverage.toFixed(2)}</>}
          </div>
        )}
      </div>
    </div>
  );
}
