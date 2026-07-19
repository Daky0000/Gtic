import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { AnnouncementsBanner } from "@/components/announcements-banner";
import { Flash } from "@/components/flash";
import { PageHeader, Card } from "@/components/ui";

export const metadata = { title: "Student Portal" };

export default async function StudentHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePortal("student");
  const { error } = await searchParams;
  const student = await db.student.findUnique({
    where: { userId: user.id },
    include: { programme: true, curriculumVersion: true },
  });

  const semester = await db.semester.findFirst({ where: { isCurrent: true } });
  const registration = student && semester
    ? await db.registration.findUnique({ where: { studentId_semesterId: { studentId: student.id, semesterId: semester.id } } })
    : null;
  const invoices = student ? await db.invoice.findMany({ where: { studentId: student.id, status: { not: "PAID" } } }) : [];
  const outstanding = invoices.reduce((s, i) => s + (i.total - i.paid), 0);
  const latestResult = student
    ? await db.semesterResult.findFirst({ where: { studentId: student.id }, orderBy: { publishedAt: "desc" } })
    : null;

  const firstName = user.name.split(/\s+/)[0] || user.name;
  // Ghana runs on UTC, which the server also uses — so the hour is right for
  // the audience without any timezone gymnastics.
  const hour = new Date().getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="scr">
      <PageHeader
        title={<>{greeting}, <em className="text-forest">{firstName}.</em></>}
        lead={student ? `${student.programme.name} · ${student.status.toLowerCase()}` : "Your student dashboard."}
      />

      <Flash error={error} />

      <div className="mb-6">
        <AnnouncementsBanner audience="STUDENTS" />
      </div>

      {!student ? (
        <div className="rounded-2xl border border-gold/30 bg-[#f6efdf] p-5 text-sm text-[#7a5a22]">
          You hold the student role but have no student record yet — this normally happens
          automatically when the Registrar enrolls an accepted applicant.
        </div>
      ) : (
        <>
          <Card className="mb-6">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Index number" value={<span className="font-mono">{student.indexNo}</span>} />
              <Field label="Programme" value={student.programme.name} />
              <Field label="Status" value={student.status} />
            </div>
            {student.curriculumVersion && (
              <div className="mt-3 border-t border-line-soft pt-3 text-xs text-faint">
                Curriculum: {student.curriculumVersion.name}
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              href="/student/registration"
              label="Registration"
              value={registration ? registration.status : "Not registered"}
              sub={semester?.label ?? "No current semester"}
            />
            <MetricCard
              href="/student/fees"
              label="Outstanding fees"
              value={formatGHS(outstanding)}
              sub={outstanding > 0 ? "Payment required" : "All clear"}
            />
            <MetricCard
              href="/student/results"
              label="Cumulative average"
              value={latestResult ? latestResult.cumulativeAverage.toFixed(2) : "—"}
              sub={latestResult ? latestResult.standing : "No results yet"}
            />
          </div>

          <p className="mt-6 text-sm">
            <Link href="/student/profile" className="text-forest hover:text-moss">
              View / update my profile →
            </Link>
          </p>
        </>
      )}

      <p className="mt-6 text-sm text-muted">
        The AI assistant (bottom-right) answers questions from the student handbook and examination
        regulations.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{label}</div>
      <div className="text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function MetricCard({
  href,
  label,
  value,
  sub,
}: {
  href: string;
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-forest"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{label}</div>
      <div className="mt-2 font-serif text-[26px] text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </Link>
  );
}
