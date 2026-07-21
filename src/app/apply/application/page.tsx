import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "My Application" };

/**
 * The Renewable Energy Training form (short courses) is the applicant-facing
 * admission form now — send anyone landing here straight into it: back to
 * their existing registration if they have one, or to the course picker to
 * start one. The flagship diploma-programme Application record this route
 * used to render is untouched in the database (staff can still review any
 * that exist), it just no longer has a wizard here.
 */
export default async function ApplicationPage() {
  const user = await requirePortal("apply");

  const existingReg = await db.shortCourseRegistration.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (existingReg) redirect(`/short-courses/register/${existingReg.id}`);
  redirect("/short-courses");
}
