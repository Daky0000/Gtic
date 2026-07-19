import "server-only";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { sendSMS } from "@/lib/sms";
import { ROLES } from "@/lib/rbac";
import { paymentReference, voucherPin, voucherSerial } from "@/lib/codes";
import { getOrCreateDraftApplication } from "@/lib/actions/admissions";

/**
 * Payment-first applicant registration. No account exists until the
 * application voucher is paid: startPendingRegistration stores the details
 * (with a pre-hashed password) and issues a Serial/PIN; completePendingRegistration
 * — driven by the Paystack callback AND webhook, so it is idempotent — creates
 * the account, applicant role and draft application once the money is confirmed.
 */

export type StartPendingResult =
  | { kind: "pending"; reference: string; email: string }
  | { kind: "error"; message: string };

/** Creates the held registration and returns the Paystack reference to charge. */
export async function startPendingRegistration(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
  cycleId: string;
  amount: number;
}): Promise<StartPendingResult> {
  // Pre-hash the password with better-auth's own hasher, so the credential
  // account created after payment verifies exactly like a normal signup.
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(params.password);

  const reg = await db.pendingRegistration.create({
    data: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      passwordHash,
      cycleId: params.cycleId,
      amount: params.amount,
      reference: paymentReference(),
      serial: voucherSerial(),
      pin: voucherPin(),
    },
  });
  return { kind: "pending", reference: reg.reference, email: reg.email };
}

/**
 * Creates the real account for a paid pending registration. Idempotent: a
 * second call (webhook after callback, or a retry) returns the existing user.
 * Returns null if the reference is unknown.
 */
export async function completePendingRegistration(reference: string): Promise<{ userId: string; email: string } | null> {
  const reg = await db.pendingRegistration.findUnique({ where: { reference } });
  if (!reg) return null;
  if (reg.status === "COMPLETED" && reg.userId) {
    return { userId: reg.userId, email: reg.email };
  }

  // Guard against a race where the email was taken between signup and payment
  // (e.g. two devices). If a user already exists, attach the payment to them
  // rather than erroring — they paid, so they must end up with an account.
  let user = await db.user.findUnique({ where: { email: reg.email } });
  if (!user) {
    user = await db.user.create({
      data: { name: reg.name, email: reg.email, emailVerified: true },
    });
    await db.account.create({
      data: { accountId: user.id, providerId: "credential", userId: user.id, password: reg.passwordHash },
    });
  }

  // Applicant role (idempotent).
  const role = await db.role.upsert({
    where: { code: ROLES.APPLICANT },
    update: {},
    create: { code: ROLES.APPLICANT, name: "Prospective Applicant" },
  });
  const hasRole = await db.roleAssignment.findFirst({ where: { userId: user.id, roleId: role.id } });
  if (!hasRole) await db.roleAssignment.create({ data: { userId: user.id, roleId: role.id } });

  // Draft application + a PAID application-fee invoice (the money already
  // arrived on the registration reference), so the fee gate is cleared.
  const app = await getOrCreateDraftApplication(user.id);
  if (app) {
    await db.application.update({ where: { id: app.id }, data: { phone: reg.phone } });
    const existingInvoice = await db.invoice.findFirst({
      where: { userId: user.id, kind: "APPLICATION", meta: { path: ["applicationId"], equals: app.id } },
    });
    if (!existingInvoice) {
      const invoice = await db.invoice.create({
        data: {
          invoiceNo: `INV-APP-${Date.now().toString(36).toUpperCase()}`,
          kind: "APPLICATION",
          userId: user.id,
          total: reg.amount,
          paid: reg.amount,
          status: "PAID",
          meta: { applicationId: app.id, registrationSerial: reg.serial },
          lines: { create: [{ description: "Application voucher fee", amount: reg.amount }] },
        },
      });
      await db.payment.create({
        data: {
          invoiceId: invoice.id,
          channel: "PAYSTACK",
          reference: reg.reference,
          amount: reg.amount,
          status: "CONFIRMED",
          paidAt: new Date(),
          meta: { registrationSerial: reg.serial },
        },
      });
    }
  }

  await db.pendingRegistration.update({
    where: { id: reg.id },
    data: { status: "COMPLETED", userId: user.id, completedAt: new Date() },
  });

  await audit({ actorId: user.id, action: "account.applicant_registered_paid", entityType: "User", entityId: user.id, after: { serial: reg.serial } });
  try {
    await notify(
      user.id,
      "Welcome to SYDA-GTIC",
      `Your application voucher is paid. Voucher Serial ${reg.serial}, PIN ${reg.pin} — keep these safe. Complete your application form to proceed.`,
      "/apply"
    );
    await sendSMS({
      to: reg.phone,
      message: `SYDA-GTIC: payment received. Your application voucher Serial: ${reg.serial}, PIN: ${reg.pin}. Sign in at the portal with your email to complete your application.`,
    });
  } catch (e) {
    console.error("[registration] post-completion notify/SMS failed", e);
  }

  return { userId: user.id, email: reg.email };
}
