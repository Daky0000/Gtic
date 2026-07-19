import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidPaystackSignature } from "@/lib/paystack";
import { confirmPayment } from "@/lib/payments";
import { completePendingRegistration } from "@/lib/registration";

/**
 * Paystack server-to-server webhook (charge.success). This is the reliable
 * settlement path — the browser callback is best-effort. confirmPayment is
 * idempotent, so receiving both (or duplicate webhooks) is harmless.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!(await isValidPaystackSignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event: string; data?: { reference?: string; amount?: number } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event === "charge.success" && event.data?.reference) {
    // Payment-first registration: the reference belongs to a held signup,
    // not a Payment. This is the reliable path for payers who closed the
    // browser before the callback — the account is created here. Idempotent.
    const pending = await db.pendingRegistration.findUnique({ where: { reference: event.data.reference } });
    if (pending && (event.data.amount ?? 0) >= pending.amount) {
      await completePendingRegistration(event.data.reference);
      return NextResponse.json({ received: true });
    }

    const payment = await db.payment.findUnique({ where: { reference: event.data.reference } });
    if (payment && payment.channel === "PAYSTACK" && (event.data.amount ?? 0) >= payment.amount) {
      // A payment superseded as FAILED (stale checkout tab) can still be
      // charged by Paystack; the signature-verified charge is ground truth,
      // so revive it before confirming rather than dropping the money.
      if (payment.status === "FAILED") {
        await db.payment.updateMany({
          where: { id: payment.id, status: "FAILED" },
          data: { status: "PENDING" },
        });
      }
      await confirmPayment(payment.id);
    }
  }

  // Always 200 for recognised signatures so Paystack stops retrying.
  return NextResponse.json({ received: true });
}
