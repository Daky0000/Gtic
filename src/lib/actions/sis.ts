"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { indexNumber } from "@/lib/codes";

/**
 * Registrar action (REG-04): converts an accepted applicant into a student
 * record with zero re-entry of data already captured at application time.
 */
export async function enrollAcceptedApplicant(formData: FormData) {
  const registrar = await requireRole(ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const applicationId = String(formData.get("applicationId"));

  const app = await db.application.findFirstOrThrow({
    where: { id: applicationId },
    include: { offer: true },
  });
  if (app.status !== "ACCEPTED") throw new Error("Only accepted applications can be enrolled.");
  if (!app.offer) throw new Error("This application has no offer on record.");

  const currentYear = await db.academicYear.findFirstOrThrow({ where: { isCurrent: true } });
  const curriculum = await db.curriculumVersion.findFirst({
    where: { programmeId: app.offer.programmeId },
    orderBy: { name: "desc" },
  });
  const studentRole = await db.role.findUniqueOrThrow({ where: { code: ROLES.STUDENT } });

  const student = await db.$transaction(async (tx) => {
    // Upsert on userId: a person can only ever hold one Student record. This
    // also makes enrollment idempotent for an account that already has one
    // (e.g. a tester's super user holding both the applicant and student
    // roles at once) — it's re-pointed at this application rather than
    // erroring on the unique constraint.
    const created = await tx.student.upsert({
      where: { userId: app.userId },
      update: {
        programmeId: app.offer!.programmeId,
        curriculumVersionId: curriculum?.id,
        entryYearId: currentYear.id,
        applicationId: app.id,
        status: "ACTIVE",
      },
      create: {
        userId: app.userId,
        indexNo: indexNumber(currentYear.label),
        programmeId: app.offer!.programmeId,
        curriculumVersionId: curriculum?.id,
        entryYearId: currentYear.id,
        applicationId: app.id,
        status: "ACTIVE",
      },
    });
    await tx.application.update({ where: { id: app.id }, data: { status: "ENROLLED" } });
    const hasRole = await tx.roleAssignment.findFirst({
      where: { userId: app.userId, roleId: studentRole.id },
    });
    if (!hasRole) {
      await tx.roleAssignment.create({ data: { userId: app.userId, roleId: studentRole.id } });
    }
    return created;
  });

  await audit({
    actorId: registrar.id, action: "sis.applicant_enrolled", entityType: "Student",
    entityId: student.id, after: { applicationId: app.id, indexNo: student.indexNo },
  });

  redirect("/staff/enrollment");
}

/** ST-03: students may self-update contact details; identity fields require
 * a documented change request handled by the Registrar (not yet built). */
export async function updateStudentContact(formData: FormData) {
  const user = await requireUser();
  const student = await db.student.findUniqueOrThrow({ where: { userId: user.id } });

  // Contact details live on the User row today (name/email); phone/address
  // are captured on the originating Application — updated there so the
  // student's one record of truth stays consistent.
  if (student.applicationId) {
    await db.application.update({
      where: { id: student.applicationId },
      data: {
        phone: String(formData.get("phone") ?? ""),
        address: String(formData.get("address") ?? ""),
        emergencyName: String(formData.get("emergencyName") ?? ""),
        emergencyPhone: String(formData.get("emergencyPhone") ?? ""),
      },
    });
  }

  redirect("/student/profile");
}
