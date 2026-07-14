"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}

function fail(message: string): never {
  redirect(`/staff/timetable?error=${encodeURIComponent(message)}`);
}

export async function addTeachingSession(formData: FormData) {
  const registrar = await requireRole(ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const offeringId = String(formData.get("offeringId"));
  const venueId = String(formData.get("venueId"));
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = String(formData.get("startTime"));
  const endTime = String(formData.get("endTime"));
  if (endTime <= startTime) fail("End time must be after start time.");

  const offering = await db.courseOffering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { lecturers: true },
  });

  const sameDaySessions = await db.timetableSession.findMany({
    where: { kind: "TEACHING", dayOfWeek, offering: { semesterId: offering.semesterId } },
    include: { offering: { include: { lecturers: true } } },
  });

  for (const s of sameDaySessions) {
    if (!s.startTime || !s.endTime) continue;
    if (!overlaps(startTime, endTime, s.startTime, s.endTime)) continue;
    if (s.venueId === venueId) {
      fail(`Venue clash with an existing session on ${DAY_NAMES[dayOfWeek]}.`);
    }
    const lecturerClash = s.offering.lecturers.some((l) => offering.lecturers.some((ol) => ol.staffUserId === l.staffUserId));
    if (lecturerClash) fail(`Lecturer clash with an existing session on ${DAY_NAMES[dayOfWeek]}.`);
  }

  const venue = await db.venue.findUniqueOrThrow({ where: { id: venueId } });
  const expectedSize = await db.registrationCourse.count({ where: { offeringId } });
  if (expectedSize > venue.capacity) {
    fail(`Venue capacity (${venue.capacity}) is below current registrations (${expectedSize}).`);
  }

  await db.timetableSession.create({
    data: { kind: "TEACHING", offeringId, venueId, dayOfWeek, startTime, endTime },
  });
  await audit({ actorId: registrar.id, action: "timetable.session_added", entityType: "CourseOffering", entityId: offeringId });
  redirect("/staff/timetable");
}
