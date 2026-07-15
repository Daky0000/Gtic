"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";

/** REG-02: every date-gated behaviour in the system reads from these windows. */
export async function updateWindowDates(formData: FormData) {
  const registrar = await requireRole(ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const windowId = String(formData.get("windowId"));
  const opensAt = new Date(String(formData.get("opensAt")));
  const closesAt = new Date(String(formData.get("closesAt")));
  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime()) || closesAt <= opensAt) {
    redirect(`/admin/calendar?error=${encodeURIComponent("The closing date must come after the opening date.")}`);
  }

  await db.window.update({ where: { id: windowId }, data: { opensAt, closesAt } });
  await audit({
    actorId: registrar.id, action: "sis.window_updated", entityType: "Window",
    entityId: windowId, after: { opensAt, closesAt },
  });

  redirect("/admin/calendar");
}
