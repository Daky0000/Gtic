import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { reconcilePendingPaystackPayments } from "@/lib/payments";
import { startShortCourseRegistration } from "@/lib/actions/short-courses";
import { formatGHS } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { RegistrationView } from "../../short-courses/register/registration-view";

export const metadata = { title: "My Application" };

const RETURN_TO = "/apply/application";

/**
 * The Renewable Energy Training form (short courses) is the applicant-facing
 * admission form now — this renders it directly at the stable /apply
 * URL instead of the old flagship diploma-programme wizard. An applicant
 * with no registration yet picks a training session first (the paper form's
 * own Section B, just moved ahead of the rest of the sections since a
 * registration always belongs to exactly one course); once one exists, the
 * full form renders here and every action loops back to this same URL.
 */
export default async function ApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string; saved?: string; submitted?: string; paid?: string; uploaded?: string; step?: string;
    paymentSubmitted?: string;
  }>;
}) {
  const user = await requirePortal("apply");
  const resolvedSearchParams = await searchParams;

  await reconcilePendingPaystackPayments(user.id);

  const reg = await db.shortCourseRegistration.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      shortCourse: { include: { batches: { orderBy: { startDate: "asc" } } } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (reg) {
    return <RegistrationView reg={reg} returnTo={RETURN_TO} searchParams={resolvedSearchParams} />;
  }

  const courses = await db.shortCourse.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { batches: { where: { active: true }, orderBy: { startDate: "asc" } } },
  });
  const now = new Date();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={<>My <em className="text-forest">application.</em></>}
        lead="Select the training session you're applying for to start your Renewable Energy Training application."
      />
      {resolvedSearchParams.error && (
        <p role="alert" className="mb-4 rounded-[11px] bg-[#faece9] p-3 text-sm text-[#b23a2e]">
          {resolvedSearchParams.error}
        </p>
      )}

      <div className="space-y-3">
        {courses.map((c) => {
          const priced = c.feePesewas > 0;
          const openBatches = c.batches.filter((b) => b.startDate > now);
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-5">
              <div>
                <h2 className="font-serif text-[19px] text-ink">{c.name}</h2>
                <p className="mt-0.5 text-xs text-faint">
                  {c.durationWeeks} weeks ·{" "}
                  {openBatches[0]
                    ? `next batch ${openBatches[0].label} — ${openBatches[0].startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                    : "batches to be scheduled"}{" "}
                  · {priced ? formatGHS(c.feePesewas) : "fee to be announced"}
                </p>
              </div>
              {priced ? (
                <form action={startShortCourseRegistration}>
                  <input type="hidden" name="shortCourseId" value={c.id} />
                  <input type="hidden" name="returnTo" value={RETURN_TO} />
                  <button type="submit" className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep">
                    Apply
                  </button>
                </form>
              ) : (
                <span className="text-xs text-faint">Opens once the fee is published</span>
              )}
            </div>
          );
        })}
        {courses.length === 0 && <p className="text-sm text-faint">No training sessions published yet.</p>}
      </div>
    </div>
  );
}
