import { redirect } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { reconcilePendingPaystackPayments } from "@/lib/payments";
import { RegistrationView } from "../registration-view";

export const metadata = { title: "Course Registration" };

export default async function ShortCourseRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string; saved?: string; submitted?: string; paid?: string; uploaded?: string; step?: string;
    paymentSubmitted?: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const reg = await db.shortCourseRegistration.findFirst({
    where: { id, userId: user.id },
    include: {
      shortCourse: { include: { batches: { orderBy: { startDate: "asc" } } } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!reg) redirect("/short-courses");

  await reconcilePendingPaystackPayments(user.id);

  return <RegistrationView reg={reg} returnTo={`/short-courses/register/${reg.id}`} searchParams={resolvedSearchParams} />;
}
