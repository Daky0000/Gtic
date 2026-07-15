"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo, paymentReference } from "@/lib/codes";
import { beginInvoicePayment, confirmPayment } from "@/lib/payments";
import { notify } from "@/lib/notify";
import { formatGHS } from "@/lib/money";

/** FIN-02: bulk-generate this semester's tuition bills from the active fee
 * schedule. Idempotent per student — running it twice does not double-bill. */
export async function generateSemesterBills() {
  const finance = await requireRole(ROLES.FINANCE_OFFICER, ROLES.SYSTEM_ADMIN);

  const semester = await db.semester.findFirstOrThrow({ where: { isCurrent: true }, include: { academicYear: true } });
  const students = await db.student.findMany({ where: { status: "ACTIVE" }, include: { programme: true } });

  let created = 0;
  for (const student of students) {
    const existing = await db.invoice.findFirst({
      where: { studentId: student.id, semesterId: semester.id, kind: "TUITION" },
    });
    if (existing) continue;

    const schedule = await db.feeSchedule.findFirst({
      where: { academicYearId: semester.academicYearId, level: student.programme.level },
      include: { items: true },
    });
    if (!schedule || schedule.items.length === 0) continue;

    const total = schedule.items.reduce((s, i) => s + i.amount, 0);
    await db.invoice.create({
      data: {
        invoiceNo: invoiceNo("TUI"),
        kind: "TUITION",
        userId: student.userId,
        studentId: student.id,
        semesterId: semester.id,
        total,
        lines: { create: schedule.items.map((i) => ({ description: i.name, amount: i.amount })) },
      },
    });
    created++;
  }

  await audit({
    actorId: finance.id, action: "finance.bills_generated", entityType: "Semester",
    entityId: semester.id, after: { studentsBilled: created },
  });
  redirect("/staff/finance");
}

export async function payTuition(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId"));
  const invoice = await db.invoice.findFirstOrThrow({ where: { id: invoiceId, userId: user.id } });
  if (invoice.status === "PAID") redirect("/student/fees");

  const result = await beginInvoicePayment({
    invoiceId: invoice.id,
    userEmail: user.email,
    returnTo: "/student/fees",
  });
  if (result.kind === "failed") {
    redirect(`/student/fees?error=${encodeURIComponent(result.message)}`);
  }
  redirect(result.kind === "redirect" ? result.url : "/student/fees?paid=1");
}

export async function recordTellerPayment(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId"));
  const amount = Math.round(Number(formData.get("amount")) * 100);
  const tellerRef = String(formData.get("tellerRef") ?? "").trim();
  if (!tellerRef || !Number.isFinite(amount) || amount <= 0) {
    redirect(`/student/fees?error=${encodeURIComponent("Enter a valid teller reference and amount.")}`);
  }

  const invoice = await db.invoice.findFirstOrThrow({ where: { id: invoiceId, userId: user.id } });
  await db.payment.create({
    data: {
      invoiceId: invoice.id, channel: "TELLER", reference: paymentReference(),
      amount, status: "PENDING", meta: { tellerRef },
    },
  });
  redirect("/student/fees");
}

export async function confirmTellerPayment(formData: FormData) {
  const finance = await requireRole(ROLES.FINANCE_OFFICER, ROLES.SYSTEM_ADMIN);
  const paymentId = String(formData.get("paymentId"));

  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: true } });
  if (payment.status !== "PENDING") {
    redirect(`/staff/finance?error=${encodeURIComponent("This payment has already been processed.")}`);
  }

  await confirmPayment(payment.id, finance.id);
  await audit({ actorId: finance.id, action: "finance.teller_confirmed", entityType: "Payment", entityId: payment.id });
  await notify(
    payment.invoice.userId,
    "Payment confirmed",
    `Your bank teller payment of ${formatGHS(payment.amount)} on invoice ${payment.invoice.invoiceNo} has been confirmed.`,
    "/student/fees"
  );
  redirect("/staff/finance");
}

export async function rejectTellerPayment(formData: FormData) {
  const finance = await requireRole(ROLES.FINANCE_OFFICER, ROLES.SYSTEM_ADMIN);
  const paymentId = String(formData.get("paymentId"));

  const payment = await db.payment.update({
    where: { id: paymentId },
    data: { status: "FAILED" },
    include: { invoice: true },
  });
  await audit({ actorId: finance.id, action: "finance.teller_rejected", entityType: "Payment", entityId: paymentId });
  await notify(
    payment.invoice.userId,
    "Payment could not be verified",
    `Your bank teller payment on invoice ${payment.invoice.invoiceNo} could not be verified. Please check the reference and resubmit, or contact the finance office.`,
    "/student/fees"
  );
  redirect("/staff/finance");
}
