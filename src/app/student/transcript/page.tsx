import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { generateTranscript } from "@/lib/actions/exams";
import { classOfDegree } from "@/lib/grading";

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
  const institution = await db.institution.findFirst();
  const institutionName = institution?.name ?? "SYDA — Green Energy & Innovation Center";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My transcript</h1>
        <form action={generateTranscript}>
          <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
            Generate verifiable transcript
          </button>
        </form>
      </div>

      {latestIssued && (
        <div className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-900">
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

        {results.map((r) => (
          <div key={r.id} className="mt-5">
            <h3 className="text-sm font-semibold text-brand-800">{r.semester.label}</h3>
            <table className="mt-1 w-full text-left text-xs">
              <tbody>
                {entries.filter((e) => e.gradeSheet.offering.semesterId === r.semesterId).map((e) => (
                  <tr key={e.id} className="border-t border-ink-100">
                    <td className="py-1">{e.gradeSheet.offering.course.code}</td>
                    <td className="py-1">{e.gradeSheet.offering.course.title}</td>
                    <td className="py-1 font-mono">{e.total?.toFixed(1)}</td>
                    <td className="py-1 font-mono">{e.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-right text-xs text-ink-500">Semester average: {r.semesterAverage.toFixed(2)} · Cumulative: {r.cumulativeAverage.toFixed(2)}</div>
          </div>
        ))}
        {results.length === 0 && <p className="mt-4 text-sm text-ink-500">No published results yet.</p>}
      </div>
    </div>
  );
}
