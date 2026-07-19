"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo } from "@/lib/codes";
import { beginInvoicePayment } from "@/lib/payments";

const BACK = "/short-courses";

function fail(message: string): never {
  redirect(`${BACK}?error=${encodeURIComponent(message)}`);
}

/**
 * Registers the signed-in user for a 2-week short course and sends them to
 * checkout. Re-entering (unpaid registration, second tab) resumes the same
 * registration and invoice rather than stacking new ones.
 */
export async function registerForShortCourse(formData: FormData) {
  const user = await requireUser();
  const shortCourseId = String(formData.get("shortCourseId"));
  const phone = String(formData.get("phone") ?? "").trim() || null;

  const course = await db.shortCourse.findUnique({ where: { id: shortCourseId } });
  if (!course || !course.active) fail("That short course is not open for registration.");
  if (course.feePesewas <= 0) {
    fail(`The fee for "${course.name}" has not been published yet — registration opens once it is.`);
  }

  const existing = await db.shortCourseRegistration.findUnique({
    where: { shortCourseId_userId: { shortCourseId: course.id, userId: user.id } },
  });
  if (existing?.status === "CONFIRMED") {
    fail(`You are already registered for "${course.name}".`);
  }

  const registration =
    existing ??
    (await db.shortCourseRegistration.create({
      data: { shortCourseId: course.id, userId: user.id, phone },
    }));
  if (existing && phone && existing.phone !== phone) {
    await db.shortCourseRegistration.update({ where: { id: existing.id }, data: { phone } });
  }

  // One invoice per registration, reused across retries.
  let invoice = registration.invoiceId
    ? await db.invoice.findUnique({ where: { id: registration.invoiceId } })
    : null;
  if (!invoice) {
    invoice = await db.invoice.create({
      data: {
        invoiceNo: invoiceNo("SHO"),
        kind: "SHORT_COURSE",
        userId: user.id,
        total: course.feePesewas,
        meta: { registrationId: registration.id, shortCourseCode: course.code },
        lines: {
          create: [{ description: `${course.name} — 2-week intensive`, amount: course.feePesewas }],
        },
      },
    });
    await db.shortCourseRegistration.update({
      where: { id: registration.id },
      data: { invoiceId: invoice.id },
    });
    await audit({
      actorId: user.id,
      action: "short_course.registered",
      entityType: "ShortCourse",
      entityId: course.id,
      after: { registrationId: registration.id, invoiceNo: invoice.invoiceNo },
    });
  }

  const result = await beginInvoicePayment({
    invoiceId: invoice.id,
    userEmail: user.email,
    returnTo: BACK,
  });
  if (result.kind === "failed") fail(result.message);
  if (result.kind === "settled") redirect(`${BACK}?paid=1`);
  redirect(result.url);
}
