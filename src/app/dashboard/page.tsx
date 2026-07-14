import { redirect } from "next/navigation";
import { getCurrentUser, homePortalFor, PORTAL_HOME } from "@/lib/rbac";

/** Post-login dispatcher: sends the user to the highest-priority portal they may enter. */
export default async function DashboardDispatch() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
