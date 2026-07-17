import "server-only";
import { db } from "@/lib/db";
import { paymentReference } from "@/lib/codes";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatGHS } from "@/lib/money";
import { initializePaystackTransaction, isPaystackConfigured } from "@/lib/paystack";
import { appBaseUrl } from "@/lib/base-url";

/**
 * Payment layer. Online payments go through Paystack (cards + MTN/Telecel/AT
 * mobile money) when PAYSTACK_SECRET_KEY is configured; otherwise they settle
 * instantly on the MOCK channel so every fee-gated flow still works in demos.
 *
 * Domain follow-ups (accepting an offer, confirming a hostel bed, queueing a
 * document request) run in settleInvoiceSideEffects — on CONFIRMATION, never
 * on initiation — so they fire exactly once whether the money arrived via
 * Paystack redirect, Paystack webhook, bank teller, or the mock.
 */

// percentPaid lives in money.ts (pure, unit-tested); re-exported here because
// every fee-gate call site historically imports it from the payment layer.
export { percentPaid } from "@/lib/money";

// ─── Confirmation (single source of truth for all channels) ───

/**
 * Marks a PENDING payment CONFIRMED, applies it to the invoice and runs the
 * invoice's domain side effects. Idempotent: the atomic status flip makes a
 * duplicate webhook/callback a no-op. Returns false if already processed.
 */
export async function confirmPayment(paymentId: string, actorId?: string): Promise<boolean> {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { invoice: true },
  });

  // Status flip and ledger credit commit together: a crash mid-way can never
  // leave a CONFIRMED payment that was not applied to its invoice (which the
  // idempotency guard would then skip forever on webhook retry).
  const invoice = await db.$transaction(async (tx) => {
    const flipped = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "CONFIRMED", paidAt: new Date() },
    });
    if (flipped.count === 0) return null;

    const credited = await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { paid: { increment: payment.amount } },
    });
    return tx.invoice.update({
      where: { id: credited.id },
      data: { status: credited.paid >= credited.total ? "PAID" : "PART_PAID" },
    });
  });
  if (!invoice) return false;

  await audit({
    actorId: actorId ?? payment.invoice.userId,
    action: "finance.payment_confirmed",
    entityType: "Invoice",
    entityId: payment.invoiceId,
    after: { amount: payment.amount, reference: payment.reference, channel: payment.channel },
  });

  if (invoice.paid >= invoice.total) {
    await settleInvoiceSideEffects(invoice.id);
  }
  if (payment.channel === "PAYSTACK") {
    await notify(
      payment.invoice.userId,
      "Payment received",
      `Your payment of ${formatGHS(payment.amount)} on invoice ${payment.invoice.invoiceNo} was received. Thank you.`,
    );
  }
  return true;
}

/** Domain follow-ups that must happen once an invoice is fully paid. */
async function settleInvoiceSideEffects(invoiceId: string) {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  switch (invoice.kind) {
    case "ACCEPTANCE": {
      const meta = invoice.meta as { applicationId?: string } | null;
      if (!meta?.applicationId) return;
      const app = await db.application.findUnique({ where: { id: meta.applicationId } });
      if (!app || app.status !== "OFFER_ISSUED") return;
      await db.$transaction([
        db.offer.update({ where: { applicationId: app.id }, data: { acceptedAt: new Date() } }),
        db.application.update({ where: { id: app.id }, data: { status: "ACCEPTED" } }),
      ]);
      await audit({
        actorId: invoice.userId, action: "admissions.offer_accepted",
        entityType: "Application", entityId: app.id,
      });
      await notify(
        invoice.userId,
        "Admission confirmed",
        "Your acceptance fee is paid and your place is secured. Enrollment instructions will follow.",
        "/apply/letter"
      );
      return;
    }
    case "HOSTEL": {
      const booking = await db.booking.findFirst({ where: { invoiceId, status: "HELD" } });
      if (!booking) return;
      await db.booking.update({ where: { id: booking.id }, data: { status: "PAID" } });
      await notify(
        invoice.userId,
        "Hostel bed confirmed",
        "Your hostel fee is paid — your bed is confirmed. Check in at the hostel office with your student ID.",
        "/student/accommodation"
      );
      return;
    }
    case "DOCUMENT": {
      const request = await db.documentRequest.findFirst({
        where: { invoiceId, status: "PENDING_PAYMENT" },
      });
      if (!request) return;
      await db.documentRequest.update({ where: { id: request.id }, data: { status: "QUEUED" } });
      return;
    }
    default:
      // APPLICATION, TUITION, FINE: gates read the invoice status directly.
      return;
  }
}

// ─── Initiation ───

export type BeginPaymentResult =
  | { kind: "redirect"; url: string }
  | { kind: "settled" }
  | { kind: "failed"; message: string };

/**
 * Starts payment of an invoice's outstanding balance. With Paystack
 * configured this creates a PENDING payment and returns the hosted checkout
 * URL; otherwise it settles instantly on the mock channel.
 */
export async function beginInvoicePayment(params: {
  invoiceId: string;
  userEmail: string;
  /** Path the payer returns to after checkout, e.g. "/apply/payments". */
  returnTo: string;
}): Promise<BeginPaymentResult> {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: params.invoiceId } });
  const balance = invoice.total - invoice.paid;
  if (balance <= 0) return { kind: "settled" };

  if (!(await isPaystackConfigured())) {
    await payInvoiceMock(invoice.id, balance, invoice.userId);
    return { kind: "settled" };
  }

  // One active checkout per invoice: re-entering the pay flow (second tab,
  // back button) returns the SAME hosted checkout instead of stacking a new
  // PENDING payment each time — otherwise both could be paid and the invoice
  // overpaid. A pending whose amount no longer matches the balance (a partial
  // payment landed meanwhile) is superseded; the webhook revives it if money
  // actually arrives on it.
  const existing = await db.payment.findFirst({
    where: { invoiceId: invoice.id, channel: "PAYSTACK", status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const meta = existing.meta as { authorizationUrl?: string } | null;
    if (existing.amount === balance && meta?.authorizationUrl) {
      return { kind: "redirect", url: meta.authorizationUrl };
    }
    await db.payment.updateMany({
      where: { invoiceId: invoice.id, channel: "PAYSTACK", status: "PENDING" },
      data: { status: "FAILED" },
    });
  }

  const reference = paymentReference();
  const payment = await db.payment.create({
    data: {
      invoiceId: invoice.id,
      channel: "PAYSTACK",
      reference,
      amount: balance,
      status: "PENDING",
      meta: { returnTo: params.returnTo },
    },
  });

  const baseUrl = appBaseUrl();
  try {
    const { authorizationUrl } = await initializePaystackTransaction({
      email: params.userEmail,
      amount: balance,
      reference,
      callbackUrl: `${baseUrl}/api/payments/paystack/callback`,
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { meta: { returnTo: params.returnTo, authorizationUrl } },
    });
    return { kind: "redirect", url: authorizationUrl };
  } catch (e) {
    console.error("Paystack initialization failed:", e);
    return {
      kind: "failed",
      message: "The payment service is unavailable right now. Please try again shortly — you have not been charged.",
    };
  }
}

/** Instant settlement on the MOCK channel (demo mode / no Paystack key). */
export async function payInvoiceMock(invoiceId: string, amount: number, actorId?: string) {
  const reference = paymentReference();
  const payment = await db.payment.create({
    data: {
      invoiceId,
      channel: "MOCK",
      reference,
      amount,
      status: "PENDING",
    },
  });
  await confirmPayment(payment.id, actorId);
  return reference;
}
