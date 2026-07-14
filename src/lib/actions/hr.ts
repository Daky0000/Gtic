"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import type { LeaveType } from "@prisma/client";

export async function applyForLeave(formData: FormData) {
  const user = await requireUser();
  const fromDate = new Date(String(formData.get("fromDate")));
  const toDate = new Date(String(formData.get("toDate")));
  if (toDate < fromDate) throw new Error("End date must be after the start date.");

  await db.leaveRequest.create({
    data: {
      staffUserId: user.id,
      type: String(formData.get("type")) as LeaveType,
      fromDate, toDate,
      reason: String(formData.get("reason") ?? ""),
    },
  });
  redirect("/staff/hr");
}

export async function decideLeaveRequest(formData: FormData) {
  const hr = await requireRole(ROLES.HR_OFFICER, ROLES.SYSTEM_ADMIN);
  const requestId = String(formData.get("requestId"));
  const decision = String(formData.get("decision")) as "APPROVED" | "REJECTED";

  const request = await db.leaveRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.status !== "PENDING") throw new Error("Already decided.");

  await db.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: decision, decidedById: hr.id, decidedAt: new Date() },
    });
    if (decision === "APPROVED") {
      const days = Math.ceil((request.toDate.getTime() - request.fromDate.getTime()) / 86_400_000) + 1;
      const profile = await tx.staffProfile.findUnique({ where: { userId: request.staffUserId } });
      if (profile) {
        await tx.staffProfile.update({ where: { userId: request.staffUserId }, data: { leaveBalance: Math.max(0, profile.leaveBalance - days) } });
      }
    }
  });
  await audit({ actorId: hr.id, action: "hr.leave_decided", entityType: "LeaveRequest", entityId: requestId, after: { decision } });
  redirect("/staff/hr");
}
