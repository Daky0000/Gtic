"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo } from "@/lib/codes";
import { beginInvoicePayment } from "@/lib/payments";
import type { BookingStatus } from "@prisma/client";

const ACTIVE_STATUSES: BookingStatus[] = ["HELD", "PAID", "CHECKED_IN"];
const HOLD_DAYS = 5; // matches the published handbook (ACC-08)

function fail(message: string): never {
  redirect(`/student/accommodation?error=${encodeURIComponent(message)}`);
}

export async function bookBed(formData: FormData) {
  const user = await requireUser();
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) fail("No student record found.");

  const year = await db.academicYear.findFirstOrThrow({ where: { isCurrent: true } });
  const semester = await db.semester.findFirstOrThrow({ where: { isCurrent: true } });
  const window = await db.window.findUnique({ where: { semesterId_type: { semesterId: semester.id, type: "HOSTEL_BOOKING" } } });
  const now = new Date();
  if (!window || now < window.opensAt || now > window.closesAt) fail("Hostel booking is not currently open.");

  const existing = await db.booking.findFirst({
    where: { studentId: student.id, academicYearId: year.id, status: { in: ACTIVE_STATUSES } },
  });
  if (existing) fail("You already have an active hostel booking for this academic year.");

  const bedId = String(formData.get("bedId"));
  const bed = await db.bed.findUniqueOrThrow({ where: { id: bedId }, include: { room: { include: { hostel: true } } } });

  const booking = await db.$transaction(async (tx) => {
    // Availability check lives inside the transaction (with the serializable
    // isolation below) so two students racing for the last bed can't both win.
    const taken = await tx.booking.findFirst({
      where: { bedId, academicYearId: year.id, status: { in: ACTIVE_STATUSES } },
    });
    if (taken) return null;

    const invoice = await tx.invoice.create({
      data: {
        invoiceNo: invoiceNo("HOS"),
        kind: "HOSTEL",
        userId: user.id,
        studentId: student.id,
        total: bed.room.hostel.feePerYear,
        lines: { create: [{ description: `${bed.room.hostel.name} — annual hostel fee`, amount: bed.room.hostel.feePerYear }] },
      },
    });
    return tx.booking.create({
      data: {
        bedId, studentId: student.id, academicYearId: year.id,
        status: "HELD", heldUntil: new Date(now.getTime() + HOLD_DAYS * 86_400_000),
        invoiceId: invoice.id,
      },
    });
  }, { isolationLevel: "Serializable" });

  if (!booking) fail("That bed was just taken — please choose another.");

  await audit({ actorId: user.id, action: "accommodation.bed_booked", entityType: "Booking", entityId: booking.id });
  redirect("/student/accommodation");
}

export async function payHostelFee(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId"));
  const student = await db.student.findUniqueOrThrow({ where: { userId: user.id } });
  const booking = await db.booking.findFirstOrThrow({ where: { id: bookingId, studentId: student.id } });
  if (!booking.invoiceId) fail("No invoice linked to this booking.");
  if (booking.status !== "HELD") fail("This booking is not awaiting payment.");
  if (booking.heldUntil && booking.heldUntil.getTime() < Date.now()) {
    fail("Your hold on this bed has expired — please book again.");
  }

  // The booking flips to PAID in settleInvoiceSideEffects once payment confirms.
  const result = await beginInvoicePayment({
    invoiceId: booking.invoiceId,
    userEmail: user.email,
    returnTo: "/student/accommodation",
  });
  if (result.kind === "failed") fail(result.message);
  redirect(result.kind === "redirect" ? result.url : "/student/accommodation?paid=1");
}

/** ACC-08: releases bookings whose payment deadline has passed. Run manually
 * from the accommodation manager's dashboard in lieu of a background job
 * scheduler (noted as a Phase 11 hardening item). */
export async function expireUnpaidBookings() {
  const manager = await requireRole(ROLES.ACCOMMODATION_MANAGER, ROLES.SYSTEM_ADMIN);
  const result = await db.booking.updateMany({
    where: { status: "HELD", heldUntil: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  await audit({ actorId: manager.id, action: "accommodation.bookings_expired", entityType: "Booking", after: { count: result.count } });
  redirect("/staff/accommodation");
}

export async function checkInStudent(formData: FormData) {
  const manager = await requireRole(ROLES.ACCOMMODATION_MANAGER, ROLES.SYSTEM_ADMIN);
  const bookingId = String(formData.get("bookingId"));
  await db.booking.update({ where: { id: bookingId }, data: { status: "CHECKED_IN", checkedInAt: new Date() } });
  await audit({ actorId: manager.id, action: "accommodation.checked_in", entityType: "Booking", entityId: bookingId });
  redirect("/staff/accommodation");
}

export async function checkOutStudent(formData: FormData) {
  const manager = await requireRole(ROLES.ACCOMMODATION_MANAGER, ROLES.SYSTEM_ADMIN);
  const bookingId = String(formData.get("bookingId"));
  await db.booking.update({ where: { id: bookingId }, data: { status: "CHECKED_OUT", checkedOutAt: new Date() } });
  await audit({ actorId: manager.id, action: "accommodation.checked_out", entityType: "Booking", entityId: bookingId });
  redirect("/staff/accommodation");
}
