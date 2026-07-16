"use server";

import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { ROLES } from "@/lib/rbac";
import { beginInvoicePayment } from "@/lib/payments";
import { currentOrBootstrapCycle } from "@/lib/admission-cycle";
import { getOrCreateDraftApplication } from "@/lib/actions/admissions";

export type SignupState = { error: string } | null;

/**
 * Applicant self-registration. The applicant chooses their own password
 * (they are signed in immediately — no one-time reveal to lose), then goes
 * straight to Paystack hosted checkout to buy the application voucher (the
 * open cycle's applicationFee — GHS 50 by default). After checkout the
 * callback drops them on /apply/application to fill in the form.
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

  let userId: string;
  try {
    // autoSignIn (better-auth default) sets the session cookie here, so the
    // applicant is already logged in when they return from Paystack.
    const res = await auth.api.signUpEmail({ body: { name, email, password } });
    userId = res.user.id;
  } catch (e) {
    if (e instanceof APIError) return { error: e.message || "Could not create your account." };
    throw e;
  }

  // Atomic so the account is never left without the applicant role.
  await db.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: { code: ROLES.APPLICANT },
      update: {},
      create: { code: ROLES.APPLICANT, name: "Prospective Applicant" },
    });
    await tx.roleAssignment.create({ data: { userId, roleId: role.id } });
  });

  await audit({ actorId: userId, action: "account.applicant_registered", entityType: "User", entityId: userId });
  try {
    await notify(
      userId,
      "Welcome to SYDA-GTIC",
      "Your account was created. Pay the application voucher fee, then complete your application form.",
      "/apply"
    );
  } catch (e) {
    console.error("[signup] welcome notification failed", e);
  }

  const app = await getOrCreateDraftApplication(userId);
  if (!app) {
    // The cycle closed in the instant between the check above and now —
    // vanishingly rare, but the account must still be usable.
    redirect("/apply");
  }
  await db.application.update({ where: { id: app.id }, data: { phone } });

  let invoice = await db.invoice.findFirst({
    where: { userId, kind: "APPLICATION", meta: { path: ["applicationId"], equals: app.id } },
  });
  if (!invoice) {
    invoice = await db.invoice.create({
      data: {
        invoiceNo: `INV-APP-${Date.now().toString(36).toUpperCase()}`,
        kind: "APPLICATION",
        userId,
        total: cycle.applicationFee,
        meta: { applicationId: app.id },
        lines: { create: [{ description: "Application voucher fee", amount: cycle.applicationFee }] },
      },
    });
  }

  let result;
  try {
    result = await beginInvoicePayment({ invoiceId: invoice.id, userEmail: email, returnTo: "/apply/application" });
  } catch (e) {
    console.error("[signup] payment initiation failed", e);
    redirect("/apply"); // account + application already exist; they can pay from /apply/payments
  }
  if (result.kind === "failed") {
    // Same reasoning: don't lose the account over a payment-gateway hiccup.
    redirect("/apply");
  }
  if (result.kind === "settled") {
    // Mock channel (no Paystack key configured) settles instantly.
    redirect("/apply/application?paid=1");
  }
  redirect(result.url);
}
