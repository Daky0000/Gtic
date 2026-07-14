import "server-only";
import { db } from "@/lib/db";
import { paymentReference } from "@/lib/codes";
import { audit } from "@/lib/audit";

/**
 * Payment adapter. Real Paystack integration (cards + MTN/Telecel/AT mobile
 * money) is a swap-in later — the mock settles instantly so every fee-gated
 * flow (registration, exams, hostel, documents) can be built and demoed now.
 */
export async function payInvoiceMock(invoiceId: string, amount: number, actorId?: string) {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const reference = paymentReference();

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId,
        channel: "MOCK",
        reference,
        amount,
        status: "CONFIRMED",
        paidAt: new Date(),
      },
    });
    const newPaid = invoice.paid + amount;
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paid: newPaid,
        status: newPaid >= invoice.total ? "PAID" : "PART_PAID",
      },
    });
  });

  await audit({
    actorId,
    action: "finance.payment_confirmed",
    entityType: "Invoice",
    entityId: invoiceId,
    after: { amount, reference, channel: "MOCK" },
  });

  return reference;
}

/** Percentage of an invoice paid so far — powers fee gates (0–100). */
export function percentPaid(invoice: { total: number; paid: number }): number {
  if (invoice.total <= 0) return 100;
  return Math.min(100, Math.round((invoice.paid / invoice.total) * 100));
}
