import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { reconcilePendingPaystackPayments } from "@/lib/payments";
import { getOrCreateDraftShortCourseRegistration } from "@/lib/actions/short-courses";
import { PageHeader } from "@/components/ui";
import { RegistrationView } from "../../short-courses/register/registration-view";

export const metadata = { title: "My Application" };

const RETURN_TO = "/apply/application";

const REG_INCLUDE = {
  shortCourse: { include: { batches: { orderBy: { startDate: "asc" as const } } } },
  documents: { orderBy: { uploadedAt: "desc" as const } },
};

/**
 * The Renewable Energy Training form (short courses) is the applicant-facing
 * admission form now — this renders it directly at the stable /apply URL
 * instead of the old flagship diploma-programme wizard. The form itself is
 * the first thing an applicant sees here: an applicant with no registration
 * yet gets one auto-created against the first open training session, and
 * which course it's actually for is just another question inside the form
 * (Training details step) rather than a separate picker gating access to it.
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

  let reg = await db.shortCourseRegistration.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: REG_INCLUDE,
  });

  if (!reg) {
    const created = await getOrCreateDraftShortCourseRegistration(user.id, user.email);
    if (!created) {
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader
            title={<>My <em className="text-forest">application.</em></>}
            lead="Apply for the Renewable Energy Training programme."
          />
          <p className="text-sm text-faint">No training sessions are open for application right now — check back soon.</p>
        </div>
      );
    }
    reg = await db.shortCourseRegistration.findUniqueOrThrow({
      where: { id: created.id },
      include: REG_INCLUDE,
    });
  }

  return <RegistrationView reg={reg} returnTo={RETURN_TO} searchParams={resolvedSearchParams} />;
}
