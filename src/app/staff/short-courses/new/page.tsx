import Link from "next/link";
import { requireRole, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { staffStartShortCourseRegistration } from "@/lib/actions/short-courses";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/flash";

export const metadata = { title: "Register a Walk-in Applicant" };

export default async function StaffNewShortCourseRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(ROLES.ADMISSIONS_OFFICER, ROLES.REGISTRAR, ROLES.MANAGEMENT, ROLES.SYSTEM_ADMIN);
  const { error } = await searchParams;

  const courses = await db.shortCourse.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/staff/short-courses" className="text-sm text-ink-500 hover:underline">← Back to registrations</Link>

      <PageHeader
        title={<>Register a <em className="text-forest">walk-in applicant.</em></>}
        lead="For someone who filled the paper application form at the Center. Enter their details here, then complete the same intake form on their behalf."
      />
      <Flash error={error} />

      <form action={staffStartShortCourseRegistration} className="card space-y-4 p-6">
        <div>
          <label className="block text-[13px] text-muted">Training session</label>
          <select
            name="shortCourseId"
            required
            className="mt-1.5 w-full rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest"
          >
            <option value="">Select…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.durationWeeks} weeks — {c.feePesewas > 0 ? formatGHS(c.feePesewas) : "fee not yet published"}
              </option>
            ))}
          </select>
          {courses.length === 0 && <p className="mt-1 text-xs text-[#a85a2e]">No active courses right now.</p>}
        </div>

        <div>
          <label className="block text-[13px] text-muted">Applicant&apos;s full name</label>
          <input
            name="applicantName"
            required
            className="mt-1.5 w-full rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest"
          />
        </div>

        <div>
          <label className="block text-[13px] text-muted">Applicant&apos;s email</label>
          <input
            type="email"
            name="applicantEmail"
            required
            className="mt-1.5 w-full rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest"
            placeholder="you@example.com"
          />
          <p className="mt-1 text-[11px] text-faint">
            Finds their existing account, or creates one — they can sign in later with a password reset.
          </p>
        </div>

        <div>
          <label className="block text-[13px] text-muted">Applicant&apos;s phone (optional)</label>
          <input
            name="applicantPhone"
            className="mt-1.5 w-full rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest"
            placeholder="0241234567"
          />
        </div>

        <button type="submit" className="rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white hover:bg-forest-deep">
          Continue to the form →
        </button>
      </form>
    </div>
  );
}
