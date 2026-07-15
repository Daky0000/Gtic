import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { confirmPayment } from "@/lib/payments";

/**
 * Paystack redirects the payer here after hosted checkout. We never trust the
 * redirect itself — the reference is re-verified against the Paystack API
 * before the payment is confirmed. The webhook covers payers who close the
 * browser before this redirect fires.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
  const back = (path: string, params: Record<string, string>) => {
    const target = new URL(path, url.origin);
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
    return NextResponse.redirect(target);
  };

  if (!reference) return back("/", { error: "Missing payment reference." });

  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.channel !== "PAYSTACK") {
    return back("/", { error: "Unknown payment reference." });
  }
  const meta = payment.meta as { returnTo?: string } | null;
  const returnTo = meta?.returnTo?.startsWith("/") ? meta.returnTo : "/";

  try {
    const result = await verifyPaystackTransaction(reference);
    if (!result.success || result.amount < payment.amount) {
      return back(returnTo, { error: "Payment was not completed. You have not been charged if you cancelled." });
    }
    await confirmPayment(payment.id);
    return back(returnTo, { paid: "1" });
  } catch {
    return back(returnTo, {
      error: "We could not verify your payment yet. If you were charged, it will reflect shortly — do not pay again.",
    });
  }
}
