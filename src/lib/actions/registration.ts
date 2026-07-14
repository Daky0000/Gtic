"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { percentPaid } from "@/lib/payments";

const FEE_GATE_PERCENT = 70; // matches the published student handbook (ST-06)

function fail(message: string): never {
  redirect(`/student/registration?error=${encodeURIComponent(message)}`);
}

export async function saveRegistration(formData: FormData) {
  const user = await requireUser();
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) fail("No student record found.");

  const semester = await db.semester.findFirst({ where: { isCurrent: true } });
  if (!semester) fail("No current semester is configured.");

  const now = new Date();
  const windows = await db.window.findMany({
    where: { semesterId: semester.id, type: { in: ["REGISTRATION", "ADD_DROP"] } },
  });
  const anyOpen = windows.some((w) => now >= w.opensAt && now <= w.closesAt);
  if (!anyOpen) fail("Registration and add/drop windows are both closed.");

  const offeringIds = formData.getAll("offeringId").map(String).filter(Boolean);
  if (offeringIds.length === 0) fail("Select at least one course.");

  const offerings = await db.courseOffering.findMany({
    where: { id: { in: offeringIds }, semesterId: semester.id },
    include: { course: { include: { requiredBy: true, prerequisites: true } } },
  });
  if (offerings.length !== offeringIds.length) fail("One of the selected courses is no longer offered.");

  // Credit-hour limits from the student's curriculum (ST-04).
  const totalCredits = offerings.reduce((sum, o) => sum + o.course.credits, 0);
  if (student.curriculumVersionId) {
    const curriculum = await db.curriculumVersion.findUniqueOrThrow({ where: { id: student.curriculumVersionId } });
    if (totalCredits < curriculum.minCredits) {
      fail(`Total credits (${totalCredits}) is below the minimum load of ${curriculum.minCredits}.`);
    }
    if (totalCredits > curriculum.maxCredits) {
      fail(`Total credits (${totalCredits}) exceeds the maximum load of ${curriculum.maxCredits}.`);
    }
  }

  // Prerequisites (ST-05): the required course must have a published PASS grade.
  for (const offering of offerings) {
    for (const req of offering.course.prerequisites) {
      const passed = await db.gradeEntry.findFirst({
        where: {
          studentId: student.id,
          grade: { not: "F" },
          gradeSheet: { status: "PUBLISHED", offering: { courseId: req.requiresId } },
        },
      });
      if (!passed) {
        const requiredCourse = await db.course.findUnique({ where: { id: req.requiresId } });
        fail(`${offering.course.code} requires a pass in ${requiredCourse?.code ?? "a prerequisite course"} first.`);
      }
    }
  }

  // Fee gate (ST-06, FIN-05): only enforced once a tuition bill actually exists.
  const tuitionInvoice = await db.invoice.findFirst({
    where: { studentId: student.id, semesterId: semester.id, kind: "TUITION" },
  });
  if (tuitionInvoice && percentPaid(tuitionInvoice) < FEE_GATE_PERCENT) {
    fail(`You must pay at least ${FEE_GATE_PERCENT}% of your semester bill before registering (currently ${percentPaid(tuitionInvoice)}%).`);
  }

  await db.$transaction(async (tx) => {
    const registration = await tx.registration.upsert({
      where: { studentId_semesterId: { studentId: student.id, semesterId: semester.id } },
      update: { status: "SUBMITTED", submittedAt: new Date() },
      create: { studentId: student.id, semesterId: semester.id, status: "SUBMITTED", submittedAt: new Date() },
    });
    await tx.registrationCourse.deleteMany({ where: { registrationId: registration.id } });
    await tx.registrationCourse.createMany({
      data: offeringIds.map((offeringId) => ({ registrationId: registration.id, offeringId })),
    });
  });

  await audit({
    actorId: user.id, action: "registration.saved", entityType: "Student",
    entityId: student.id, after: { semesterId: semester.id, offeringIds, totalCredits },
  });

  redirect("/student/registration");
}
