import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { classOfDegree, PASS_MARK } from "@/lib/grading";
import { PageHeader, Card, CardLabel, StatusChip, type ChipTone } from "@/components/ui";

export const metadata = { title: "Results" };

const STANDING_TONE: Record<string, ChipTone> = {
  GOOD: "green",
  PROBATION: "amber",
  WITHDRAWN: "neutral",
};

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

  // Courses the student is registered for this semester whose results are
  // still working through the approval chain — so "no results yet" never
  // reads as "your results are missing".
  const currentSemester = await db.semester.findFirst({ where: { isCurrent: true } });
  const registration = currentSemester
    ? await db.registration.findUnique({
        where: { studentId_semesterId: { studentId: student.id, semesterId: currentSemester.id } },
        include: { courses: { include: { offering: { include: { course: true } } } } },
      })
    : null;
  const publishedOfferingIds = new Set(publishedEntries.map((e) => e.gradeSheet.offeringId));
  const pendingCourses = (registration?.courses ?? [])
    .filter((rc) => !publishedOfferingIds.has(rc.offeringId))
    .map((rc) => rc.offering.course);

  const latest = results.at(-1);
  const totalCreditsEarned = results.reduce((s, r) => s + r.creditsEarned, 0);

  return (
    <div className="scr mx-auto max-w-3xl">
      <PageHeader
        title={<>My <em className="text-forest">results.</em></>}
        lead="Published results, credit-weighted averages and your academic standing — updated the moment the Registrar publishes a grade sheet."
      />

      {latest && (
        <Card className="mb-6">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div>
              <CardLabel>Cumulative average</CardLabel>
              <div className="font-serif text-[26px] text-ink">{latest.cumulativeAverage.toFixed(2)}</div>
            </div>
            <div>
              <CardLabel>Class (to date)</CardLabel>
              <div className="text-[15px] font-semibold text-ink">{classOfDegree(latest.cumulativeAverage)}</div>
            </div>
            <div>
              <CardLabel>Standing</CardLabel>
              <StatusChip tone={STANDING_TONE[latest.standing] ?? "neutral"}>{latest.standing}</StatusChip>
            </div>
            <div>
              <CardLabel>Credits earned</CardLabel>
              <div className="font-serif text-[26px] text-ink">{totalCreditsEarned}</div>
            </div>
          </div>
        </Card>
      )}

      {results.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            No results have been published yet. Results appear here after your lecturers&apos; grade
            sheets pass through the approval chain and the Registrar publishes them — you&apos;ll get a
            notification the moment that happens.
          </p>
        </Card>
      )}

      {results.map((r) => {
        const rows = publishedEntries.filter((e) => e.gradeSheet.offering.semesterId === r.semesterId);
        return (
          <Card key={r.id} className="mb-6 !p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
              <div>
                <h2 className="font-semibold text-brand-800">{r.semester.label}</h2>
                <p className="mt-0.5 text-xs text-faint">
                  {r.creditsEarned}/{r.creditsTaken} credits earned · published {r.publishedAt.toLocaleDateString()}
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="text-muted">Semester average <span className="font-semibold text-ink">{r.semesterAverage.toFixed(2)}</span></div>
                <div className="text-muted">Cumulative <span className="font-semibold text-ink">{r.cumulativeAverage.toFixed(2)}</span></div>
              </div>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.06em] text-faint">
                  <tr>
                    <th className="py-1.5 pr-2">Course</th>
                    <th className="py-1.5 pr-2 text-right">Credits</th>
                    <th className="py-1.5 pr-2 text-right">CA</th>
                    <th className="py-1.5 pr-2 text-right">Exam</th>
                    <th className="py-1.5 pr-2 text-right">Total</th>
                    <th className="py-1.5 text-right">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t border-line-soft">
                      <td className="py-2 pr-2">
                        <span className="font-mono text-xs text-faint">{e.gradeSheet.offering.course.code}</span>{" "}
                        {e.gradeSheet.offering.course.title}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">{e.gradeSheet.offering.course.credits}</td>
                      <td className="py-2 pr-2 text-right font-mono">{e.caScore?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 pr-2 text-right font-mono">{e.examScore?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 pr-2 text-right font-mono">{e.total?.toFixed(1) ?? "—"}</td>
                      <td className="py-2 text-right">
                        <span
                          className={`inline-block min-w-7 rounded-md px-1.5 py-0.5 text-center font-mono text-xs font-bold ${
                            (e.total ?? 0) >= PASS_MARK ? "bg-[#eaf0ea] text-forest" : "bg-[#faece9] text-[#b23a2e]"
                          }`}
                        >
                          {e.grade ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {pendingCourses.length > 0 && (
        <div className="rounded-2xl border border-gold/30 bg-[#f6efdf] p-4 text-sm text-[#7a5a22]">
          <strong>Awaiting publication:</strong>{" "}
          {pendingCourses.map((c) => c.code).join(", ")} — results for these registered courses have
          not been published yet.
        </div>
      )}
    </div>
  );
}
