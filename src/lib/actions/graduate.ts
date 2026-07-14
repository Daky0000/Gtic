"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const MILESTONES = ["Proposal", "Ethics Approval", "Data Collection", "Draft Submission", "Viva", "Final Submission"];

export async function createCandidature(formData: FormData) {
  const officer = await requireRole(ROLES.GRAD_SCHOOL_OFFICER, ROLES.SYSTEM_ADMIN);
  const studentId = String(formData.get("studentId"));
  const supervisorUserId = String(formData.get("supervisorUserId"));
  const topic = String(formData.get("topic") ?? "");

  const existing = await db.candidature.findUnique({ where: { studentId } });
  if (existing) throw new Error("This student already has a candidature.");

  await db.$transaction(async (tx) => {
    const candidature = await tx.candidature.create({ data: { studentId, supervisorUserId, topic } });
    await tx.milestone.createMany({
      data: MILESTONES.map((name, i) => ({ candidatureId: candidature.id, ord: i, name })),
    });
  });
  await audit({ actorId: officer.id, action: "graduate.candidature_created", entityType: "Student", entityId: studentId });
  redirect("/staff/graduate");
}

export async function submitMilestone(formData: FormData) {
  const user = await requireUser();
  const milestoneId = String(formData.get("milestoneId"));
  const milestone = await db.milestone.findUniqueOrThrow({
    where: { id: milestoneId },
    include: { candidature: { include: { student: true } } },
  });
  if (milestone.candidature.student.userId !== user.id) throw new Error("Not your candidature.");
  if (milestone.status !== "PENDING" && milestone.status !== "RETURNED") throw new Error("This milestone is not open for submission.");

  await db.milestone.update({ where: { id: milestoneId }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  redirect("/student/candidature");
}

export async function decideMilestone(formData: FormData) {
  const user = await requireUser();
  const milestoneId = String(formData.get("milestoneId"));
  const decision = String(formData.get("decision")) as "APPROVED" | "RETURNED";
  const feedback = String(formData.get("feedback") ?? "");

  const milestone = await db.milestone.findUniqueOrThrow({ where: { id: milestoneId }, include: { candidature: true } });
  if (milestone.candidature.supervisorUserId !== user.id) throw new Error("You are not the supervisor for this candidature.");

  await db.milestone.update({
    where: { id: milestoneId },
    data: { status: decision, feedback, approvedAt: decision === "APPROVED" ? new Date() : null },
  });
  await audit({ actorId: user.id, action: "graduate.milestone_decided", entityType: "Milestone", entityId: milestoneId, after: { decision } });
  redirect("/staff/graduate");
}

/** REG-09 / ALU-01: graduation converts a student's status and grants the
 * alumni role in one step — the same account, no re-registration. */
export async function graduateStudent(formData: FormData) {
  const registrar = await requireRole(ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const studentId = String(formData.get("studentId"));
  const student = await db.student.findUniqueOrThrow({ where: { id: studentId } });
  const alumniRole = await db.role.findUniqueOrThrow({ where: { code: ROLES.ALUMNI } });

  await db.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { status: "GRADUATED" } });
    await tx.studentStatusHistory.create({
      data: { studentId, from: student.status, to: "GRADUATED", actorId: registrar.id },
    });
    const hasRole = await tx.roleAssignment.findFirst({ where: { userId: student.userId, roleId: alumniRole.id } });
    if (!hasRole) {
      await tx.roleAssignment.create({ data: { userId: student.userId, roleId: alumniRole.id } });
    }
  });
  await audit({ actorId: registrar.id, action: "sis.student_graduated", entityType: "Student", entityId: studentId });
  redirect("/staff/enrollment");
}
