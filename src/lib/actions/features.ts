"use server";

import { redirect } from "next/navigation";
import { isDeveloper, requireRole, ROLES } from "@/lib/rbac";
import { isKnownFeatureKey, setFeatureHidden } from "@/lib/feature-flags";

/** Feature visibility is the developer's alone — same split as fees/pricing
 * (requireFees in src/lib/actions/system.ts): system admin keeps the rest of
 * the console, but this lever is reserved for the developer account. */
async function requireFeatureConsole() {
  const user = await requireRole(ROLES.DEVELOPER, ROLES.SYSTEM_ADMIN);
  if (!isDeveloper(user)) {
    redirect(`/admin?error=${encodeURIComponent("Feature visibility is managed by the developer account only.")}`);
  }
  return user;
}

export async function toggleFeature(formData: FormData) {
  const dev = await requireFeatureConsole();
  const key = String(formData.get("key") ?? "");
  const hidden = formData.get("hidden") === "1";

  if (!isKnownFeatureKey(key)) {
    redirect(`/developer/features?error=${encodeURIComponent("Unknown feature key.")}`);
  }

  await setFeatureHidden(key, hidden, dev.id);
  redirect("/developer/features?saved=1");
}
