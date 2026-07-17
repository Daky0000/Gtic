import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, homePortalFor, PORTAL_HOME, ROLES } from "@/lib/rbac";

/**
 * Post-login dispatcher: sends the user to the highest-priority portal they
 * may enter.
 *
 * Self-heal: an account with literally zero role assignments can only be an
 * orphaned self-registration (every legitimate creation path — self-signup,
 * admin-created staff, enrollment — assigns at least one role as part of
 * creating the account). Rather than show a dead end, grant the lowest-
 * privilege applicant role and send them to /apply.
 */
export default async function DashboardDispatch() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.roles.length === 0) {
    const role = await db.role.upsert({
      where: { code: ROLES.APPLICANT },
      update: {},
      create: { code: ROLES.APPLICANT, name: "Prospective Applicant" },
    });
    await db.roleAssignment.create({ data: { userId: user.id, roleId: role.id } });
    redirect(PORTAL_HOME.apply);
  }

  const portal = homePortalFor(user.roles);
  if (!portal) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">No portal access</h1>
        <p className="mt-2 text-sm text-ink-500">
          Your account has no active role. Contact the administrator.
        </p>
      </div>
    );
  }
  redirect(PORTAL_HOME[portal]);
}
