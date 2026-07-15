"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasRole, requireRole, requireUser, ROLES, type RoleCode } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { verificationCode } from "@/lib/codes";
import { PASS_MARK, scoreToGrade } from "@/lib/grading";
import { notifyMany } from "@/lib/notify";
import type { GradeSheetStatus } from "@prisma/client";

function failApprovals(message: string): never {
  redirect(`/staff/approvals?error=${encodeURIComponent(message)}`);
}

/** Lecturer's grading workspace, created on first visit (no separate "set up
 * a grade sheet" step needed — matches the getOrCreateDraftApplication
 * pattern from admissions). */
export async function getOrCreateGradeSheet(offeringId: string) {
  const existing = await db.gradeSheet.findUnique({ where: { offeringId } });
  if (existing) return existing;
  return db.gradeSheet.create({ data: { offeringId } });
}

function fail(offeringId: string, message: string): never {
  redirect(`/staff/courses/${offeringId}/grading?error=${encodeURIComponent(message)}`);
}

export async function saveGradeEntries(formData: FormData) {
  const user = await requireUser();
  const gradeSheetId = String(formData.get("gradeSheetId"));
  const offeringId = String(formData.get("offeringId"));

  const sheet = await db.gradeSheet.findUniqueOrThrow({
    where: { id: gradeSheetId },
    include: { offering: { include: { lecturers: true } } },
  });
  const isAssigned = sheet.offering.lecturers.some((l) => l.staffUserId === user.id);
  if (!isAssigned && !hasRole(user, ROLES.SYSTEM_ADMIN)) fail(offeringId, "You are not assigned to this course.");
  if (!["DRAFT", "RETURNED"].includes(sheet.status)) fail(offeringId, "This grade sheet is no longer editable.");

  const studentIds = formData.getAll("studentId").map(String);
  for (const studentId of studentIds) {
    const ca = formData.get(`ca_${studentId}`);
    const exam = formData.get(`exam_${studentId}`);
    const caScore = ca !== null && ca !== "" ? Number(ca) : null;
    const examScore = exam !== null && exam !== "" ? Number(exam) : null;
    const total = caScore != null && examScore != null ? caScore + examScore : null;

    await db.gradeEntry.upsert({
      where: { gradeSheetId_studentId: { gradeSheetId, studentId } },
      update: { caScore, examScore, total },
      create: { gradeSheetId, studentId, caScore, examScore, total },
    });
  }

  redirect(`/staff/courses/${offeringId}/grading`);
}

export async function submitGradeSheet(formData: FormData) {
  const user = await requireUser();
  const gradeSheetId = String(formData.get("gradeSheetId"));
  const offeringId = String(formData.get("offeringId"));

  const sheet = await db.gradeSheet.findUniqueOrThrow({
    where: { id: gradeSheetId },
    include: { entries: true, offering: { include: { lecturers: true } } },
  });
  const isAssigned = sheet.offering.lecturers.some((l) => l.staffUserId === user.id);
  if (!isAssigned && !hasRole(user, ROLES.SYSTEM_ADMIN)) fail(offeringId, "You are not assigned to this course.");
  if (sheet.entries.some((e) => e.total == null)) fail(offeringId, "Every student needs a CA and exam score before submitting.");

  await db.gradeSheet.update({ where: { id: gradeSheetId }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  await audit({ actorId: user.id, action: "exams.grade_sheet_submitted", entityType: "GradeSheet", entityId: gradeSheetId });

  redirect(`/staff/courses/${offeringId}/grading`);
}

const NEXT_STAGE: Record<string, { role: RoleCode; next: GradeSheetStatus; label: "HOD" | "DEAN" | "EXAMS_OFFICE" }> = {
  SUBMITTED: { role: ROLES.HOD, next: "HOD_APPROVED", label: "HOD" },
  HOD_APPROVED: { role: ROLES.DEAN, next: "DEAN_APPROVED", label: "DEAN" },
  DEAN_APPROVED: { role: ROLES.EXAMS_OFFICER, next: "VALIDATED", label: "EXAMS_OFFICE" },
};

/**
 * Approval chain (Lecturer -> HoD -> Dean -> Examinations Office). Each stage
 * checks only role membership, not "different person than the submitter" —
 * the same trade-off made for admissions (ADM-09): the structure enforces
 * separation of duties once roles are divided across real staff, while a
 * single testing super user (holding every role) can still walk the whole
 * chain end to end.
 */
export async function approveGradeSheet(formData: FormData) {
  const user = await requireUser();
  const gradeSheetId = String(formData.get("gradeSheetId"));
  const sheet = await db.gradeSheet.findUniqueOrThrow({ where: { id: gradeSheetId } });

  const stage = NEXT_STAGE[sheet.status];
  if (!stage) failApprovals("This grade sheet is not awaiting approval.");
  if (!hasRole(user, stage.role, ROLES.SYSTEM_ADMIN)) {
    failApprovals(`Requires the ${stage.label} role.`);
  }

  await db.$transaction(async (tx) => {
    // The Examinations Office stage also computes each entry's letter grade
    // and grade point from the recorded total (EXO-06 validation step).
    if (stage.next === "VALIDATED") {
      const entries = await tx.gradeEntry.findMany({ where: { gradeSheetId } });
      for (const entry of entries) {
        if (entry.total == null) continue;
        const { grade, point } = scoreToGrade(entry.total);
        await tx.gradeEntry.update({ where: { id: entry.id }, data: { grade, gradePoint: point } });
      }
    }
    await tx.gradeSheet.update({ where: { id: gradeSheetId }, data: { status: stage.next } });
    await tx.gradeSheetApproval.create({
      data: { gradeSheetId, stage: stage.label, decision: "APPROVED", actorId: user.id },
    });
  });

  await audit({ actorId: user.id, action: "exams.grade_sheet_approved", entityType: "GradeSheet", entityId: gradeSheetId, after: { stage: stage.label } });
  redirect("/staff/approvals");
}

export async function returnGradeSheet(formData: FormData) {
  const user = await requireUser();
  const gradeSheetId = String(formData.get("gradeSheetId"));
  const note = String(formData.get("note") ?? "");
  const sheet = await db.gradeSheet.findUniqueOrThrow({ where: { id: gradeSheetId } });

  const stage = NEXT_STAGE[sheet.status];
  if (!stage) failApprovals("This grade sheet cannot be returned from its current state.");
  if (!hasRole(user, stage.role, ROLES.SYSTEM_ADMIN)) failApprovals(`Requires the ${stage.label} role.`);

  await db.$transaction([
    db.gradeSheet.update({ where: { id: gradeSheetId }, data: { status: "RETURNED" } }),
    db.gradeSheetApproval.create({
      data: { gradeSheetId, stage: stage.label, decision: "RETURNED", note, actorId: user.id },
    }),
  ]);
  await audit({ actorId: user.id, action: "exams.grade_sheet_returned", entityType: "GradeSheet", entityId: gradeSheetId, after: { note } });
  redirect("/staff/approvals");
}

/**
 * Registrar's final sign-off (REG-05): publishes the sheet and recomputes
 * every affected student's semester + cumulative average (ST-09).
 */
export async function publishGradeSheet(formData: FormData) {
  const registrar = await requireRole(ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const gradeSheetId = String(formData.get("gradeSheetId"));

  const sheet = await db.gradeSheet.findUniqueOrThrow({
    where: { id: gradeSheetId },
    include: { entries: true, offering: { include: { course: true } } },
  });
  if (sheet.status !== "VALIDATED") failApprovals("This grade sheet has not been validated yet.");

  await db.gradeSheet.update({ where: { id: gradeSheetId }, data: { status: "PUBLISHED", publishedAt: new Date() } });

  for (const entry of sheet.entries) {
    await recomputeSemesterResult(entry.studentId, sheet.offering.semesterId);
  }

  const students = await db.student.findMany({
    where: { id: { in: sheet.entries.map((e) => e.studentId) } },
    select: { userId: true },
  });
  await notifyMany(
    students.map((s) => s.userId),
    "Results published",
    `Your results for ${sheet.offering.course.code} — ${sheet.offering.course.title} are now available.`,
    "/student/results"
  );

  await audit({
    actorId: registrar.id, action: "exams.results_published", entityType: "GradeSheet",
    entityId: gradeSheetId, after: { studentsAffected: sheet.entries.length },
  });
  redirect("/staff/approvals");
}

async function recomputeSemesterResult(studentId: string, semesterId: string) {
  const semesterEntries = await db.gradeEntry.findMany({
    where: { studentId, gradeSheet: { status: "PUBLISHED", offering: { semesterId } } },
    include: { gradeSheet: { include: { offering: { include: { course: true } } } } },
  });
  const allEntries = await db.gradeEntry.findMany({
    where: { studentId, gradeSheet: { status: "PUBLISHED" } },
    include: { gradeSheet: { include: { offering: { include: { course: true } } } } },
  });

  const weighted = (rows: typeof allEntries) => {
    const credits = rows.reduce((s, e) => s + e.gradeSheet.offering.course.credits, 0);
    const points = rows.reduce((s, e) => s + (e.total ?? 0) * e.gradeSheet.offering.course.credits, 0);
    return { credits, average: credits > 0 ? points / credits : 0 };
  };

  const semStats = weighted(semesterEntries);
  const cumStats = weighted(allEntries);
  const creditsEarned = semesterEntries
    .filter((e) => (e.total ?? 0) >= PASS_MARK)
    .reduce((s, e) => s + e.gradeSheet.offering.course.credits, 0);

  const priorProbation = await db.semesterResult.findFirst({
    where: { studentId, standing: "PROBATION", semesterId: { not: semesterId } },
  });
  const standing =
    cumStats.average >= PASS_MARK ? "GOOD" : priorProbation ? "WITHDRAWN" : "PROBATION";

  await db.semesterResult.upsert({
    where: { studentId_semesterId: { studentId, semesterId } },
    update: {
      creditsTaken: semStats.credits, creditsEarned, semesterAverage: semStats.average,
      cumulativeAverage: cumStats.average, standing,
    },
    create: {
      studentId, semesterId, creditsTaken: semStats.credits, creditsEarned,
      semesterAverage: semStats.average, cumulativeAverage: cumStats.average, standing,
    },
  });

  if (standing === "WITHDRAWN") {
    await db.student.update({ where: { id: studentId }, data: { status: "WITHDRAWN" } });
  }
}

/** EXO-10: generates a verifiable transcript snapshot from the live academic record. */
export async function generateTranscript() {
  const user = await requireUser();
  const student = await db.student.findUniqueOrThrow({
    where: { userId: user.id },
    include: { programme: true },
  });
  const results = await db.semesterResult.findMany({
    where: { studentId: student.id },
    orderBy: { publishedAt: "asc" },
    include: { semester: true },
  });
  const latest = results.at(-1);
  const code = verificationCode();

  await db.issuedDocument.create({
    data: {
      type: "TRANSCRIPT",
      code,
      title: `Transcript — ${student.indexNo}`,
      userId: user.id,
      payload: {
        studentName: user.name,
        indexNo: student.indexNo,
        programmeName: student.programme.name,
        cumulativeAverage: latest ? latest.cumulativeAverage.toFixed(2) : "0.00",
        semestersCompleted: String(results.length),
        issuedAt: new Date().toISOString(),
      },
    },
  });

  redirect("/student/transcript");
}
