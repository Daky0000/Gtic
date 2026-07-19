"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentOrBootstrapCycle } from "@/lib/admission-cycle";
import { initializePaystackTransaction, isPaystackConfigured } from "@/lib/paystack";
import { startPendingRegistration, completePendingRegistration } from "@/lib/registration";
import { appBaseUrl } from "@/lib/base-url";

export type SignupState = { error: string } | null;

/**
 * Payment-first applicant registration. The visitor chooses a password, then
 * "Pay to register" starts a Paystack checkout for the application voucher.
 * NO account exists until that payment confirms — the account, applicant role
 * and draft application are created by completePendingRegistration, driven by
 * the Paystack callback and webhook. After paying, the applicant signs in with
 * the email and password they chose (they also get a Serial/PIN by SMS).
 */
export async function startApplicationWithPayment(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (name.length < 2) return { error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!/^[+\d][\d\s-]{6,19}$/.test(phone)) return { error: "Enter a valid phone number." };
  if (password.length < 8) return { error: "Choose a password of at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const cycle = await currentOrBootstrapCycle();
  if (!cycle) {
    return { error: "Applications are not open right now. Please check back later." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists. Sign in instead." };
  }

  const started = await startPendingRegistration({
    name, email, phone, password, cycleId: cycle.id, amount: cycle.applicationFee,
  });
  if (started.kind === "error") return { error: started.message };

  // No Paystack key configured (demo/dev) — settle instantly: create the
  // account now and send them to sign in.
  if (!(await isPaystackConfigured())) {
    await completePendingRegistration(started.reference);
    redirect(`/login?registered=1&email=${encodeURIComponent(email)}`);
  }

  try {
    const { authorizationUrl } = await initializePaystackTransaction({
      email,
      amount: cycle.applicationFee,
      reference: started.reference,
      callbackUrl: `${appBaseUrl()}/api/payments/paystack/callback`,
    });
    redirect(authorizationUrl);
  } catch (e) {
    // redirect() throws by design — let it propagate.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    console.error("[signup] payment initiation failed", e);
    return {
      error: "We could not start the payment just now. You have not been charged — please try again in a moment.",
    };
  }
}
