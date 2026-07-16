"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { ROLES } from "@/lib/rbac";
import { generatedPassword } from "@/lib/codes";
import { beginInvoicePayment } from "@/lib/payments";
import { getOrCreateDraftApplication } from "@/lib/actions/admissions";

export type SignupState = { error: string } | null;

/** Shown once on /apply right after payment — see readTempPasswordCookie() below.
 * Not exported: "use server" modules may only export async functions. */
const TEMP_PASSWORD_COOKIE = "cc_temp_pw";
const TEMP_PASSWORD_TTL_SECONDS = 5 * 60;

/**
 * Voucher-pay-first registration (replaces manual signup): the applicant
 * never chooses a password. Paying the application fee (voucher) IS the
 * registration step — the system creates the account from their name/email/
 * phone, generates a random password, and reveals it once after payment.
 */
export async function startApplicationWithPayment(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 2) return { error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!/^[+\d][\d\s-]{6,19}$/.test(phone)) return { error: "Enter a valid phone number." };

  const cycle = await db.admissionCycle.findFirst({ where: { status: "OPEN" }, orderBy: { opensAt: "desc" } });
  if (!cycle) {
    return { error: "Applications are not open right now. Please check back later." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists. Sign in instead." };
  }

  const password = generatedPassword();
  let userId: string;
  try {
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
      "Your account and application were created when you paid the application voucher fee.",
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

  // The generated password survives the Paystack hosted-checkout round trip
  // (or the instant mock redirect) in a short-lived cookie, then expires on
  // its own — a deliberately narrow, one-time reveal window.
  (await cookies()).set(TEMP_PASSWORD_COOKIE, `${email}:${password}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TEMP_PASSWORD_TTL_SECONDS,
    path: "/",
  });

  let result;
  try {
    result = await beginInvoicePayment({ invoiceId: invoice.id, userEmail: email, returnTo: "/apply" });
  } catch (e) {
    console.error("[signup] payment initiation failed", e);
    redirect("/apply"); // account + application already exist; they can pay from there
  }
  if (result.kind === "failed") {
    // Same reasoning: don't lose the account over a payment-gateway hiccup.
    redirect("/apply");
  }
  redirect(result.kind === "redirect" ? result.url : "/apply");
}

/** Read-once helper for the /apply welcome banner. */
export async function readTempPasswordCookie(): Promise<{ email: string; password: string } | null> {
  const raw = (await cookies()).get(TEMP_PASSWORD_COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx < 0) return null;
  return { email: raw.slice(0, idx), password: raw.slice(idx + 1) };
}
