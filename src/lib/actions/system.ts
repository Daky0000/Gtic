"use server";

import { redirect } from "next/navigation";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import type { ProgrammeLevel } from "@prisma/client";

/** Developer console actions. Every action requires the developer (or
 * system admin) role — the same guard the /admin/settings pages use. */
async function requireDeveloper() {
  return requireRole(ROLES.DEVELOPER, ROLES.SYSTEM_ADMIN);
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** GHS form input ("150" / "150.50") → pesewas int, or null when invalid. */
function ghsToPesewas(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// ─── Integrations & institution ───

export async function saveIntegrations(formData: FormData) {
  const dev = await requireDeveloper();
  const back = "/admin/settings";

  const paystackKey = String(formData.get("paystackKey") ?? "").trim();
  const anthropicKey = String(formData.get("anthropicKey") ?? "").trim();
  const aiProvider = String(formData.get("aiProvider") ?? "").trim();

  if (formData.get("clearPaystack")) {
    await setSetting(SETTING_KEYS.PAYSTACK_SECRET_KEY, "", dev.id);
  } else if (paystackKey) {
    if (!/^sk_(test|live)_/.test(paystackKey)) {
      fail(back, "That doesn't look like a Paystack secret key (expected sk_test_… or sk_live_…).");
    }
    await setSetting(SETTING_KEYS.PAYSTACK_SECRET_KEY, paystackKey, dev.id);
  }

  if (formData.get("clearAnthropic")) {
    await setSetting(SETTING_KEYS.ANTHROPIC_API_KEY, "", dev.id);
  } else if (anthropicKey) {
    await setSetting(SETTING_KEYS.ANTHROPIC_API_KEY, anthropicKey, dev.id);
  }

  if (["auto", "anthropic", "mock"].includes(aiProvider)) {
    await setSetting(SETTING_KEYS.AI_PROVIDER, aiProvider === "auto" ? "" : aiProvider, dev.id);
  }

  redirect(`${back}?saved=1`);
}

export async function saveInstitution(formData: FormData) {
  const dev = await requireDeveloper();
  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("shortName") ?? "").trim();
  if (!name || !shortName) fail("/admin/settings", "Institution name and short name are required.");

  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || null;
  };
  const data = {
    name,
    shortName,
    motto: str("motto"),
    contactEmail: str("contactEmail"),
    contactPhone: str("contactPhone"),
    address: str("address"),
    website: str("website"),
  };

  const existing = await db.institution.findFirst();
  if (existing) {
    await db.institution.update({ where: { id: existing.id }, data });
  } else {
    await db.institution.create({ data });
  }
  await audit({ actorId: dev.id, action: "system.institution_updated", entityType: "Institution" });
  redirect("/admin/settings?saved=1");
}

// ─── Fees ───

export async function updateCycleFees(formData: FormData) {
  const dev = await requireDeveloper();
  const cycleId = String(formData.get("cycleId"));
  const applicationFee = ghsToPesewas(formData.get("applicationFeeGhs"));
  const acceptanceFee = ghsToPesewas(formData.get("acceptanceFeeGhs"));
  if (applicationFee == null || acceptanceFee == null) {
    fail("/admin/fees", "Enter valid amounts in GHS.");
  }

  await db.admissionCycle.update({
    where: { id: cycleId },
    data: { applicationFee, acceptanceFee },
  });
  await audit({
    actorId: dev.id, action: "system.cycle_fees_updated", entityType: "AdmissionCycle",
    entityId: cycleId, after: { applicationFee, acceptanceFee },
  });
  redirect("/admin/fees?saved=1");
}

export async function updateDocumentFees(formData: FormData) {
  const dev = await requireDeveloper();
  const entries: [string, (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]][] = [
    ["transcriptGhs", SETTING_KEYS.DOC_FEE_TRANSCRIPT],
    ["attestationGhs", SETTING_KEYS.DOC_FEE_ATTESTATION],
    ["verificationGhs", SETTING_KEYS.DOC_FEE_VERIFICATION_LETTER],
  ];
  for (const [field, key] of entries) {
    const pesewas = ghsToPesewas(formData.get(field));
    if (pesewas == null) fail("/admin/fees", "Enter valid amounts in GHS.");
    await setSetting(key, String(pesewas), dev.id);
  }
  redirect("/admin/fees?saved=1");
}

export async function updateHostelFee(formData: FormData) {
  const dev = await requireDeveloper();
  const hostelId = String(formData.get("hostelId"));
  const feePerYear = ghsToPesewas(formData.get("feeGhs"));
  if (feePerYear == null) fail("/admin/fees", "Enter a valid amount in GHS.");

  await db.hostel.update({ where: { id: hostelId }, data: { feePerYear } });
  await audit({
    actorId: dev.id, action: "system.hostel_fee_updated", entityType: "Hostel",
    entityId: hostelId, after: { feePerYear },
  });
  redirect("/admin/fees?saved=1");
}

export async function createFeeSchedule(formData: FormData) {
  const dev = await requireDeveloper();
  const academicYearId = String(formData.get("academicYearId"));
  const level = String(formData.get("level")) as ProgrammeLevel;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("/admin/fees", "Give the fee schedule a name.");

  const existing = await db.feeSchedule.findUnique({
    where: { academicYearId_level: { academicYearId, level } },
  });
  if (existing) fail("/admin/fees", "A schedule for that year and level already exists.");

  await db.feeSchedule.create({ data: { academicYearId, level, name } });
  await audit({ actorId: dev.id, action: "system.fee_schedule_created", entityType: "FeeSchedule" });
  redirect("/admin/fees?saved=1");
}

export async function addFeeItem(formData: FormData) {
  const dev = await requireDeveloper();
  const scheduleId = String(formData.get("scheduleId"));
  const name = String(formData.get("name") ?? "").trim();
  const amount = ghsToPesewas(formData.get("amountGhs"));
  if (!name || amount == null) fail("/admin/fees", "Enter a fee item name and a valid GHS amount.");

  await db.feeItem.create({ data: { scheduleId, name, amount } });
  await audit({
    actorId: dev.id, action: "system.fee_item_added", entityType: "FeeSchedule",
    entityId: scheduleId, after: { name, amount },
  });
  redirect("/admin/fees?saved=1");
}

export async function deleteFeeItem(formData: FormData) {
  const dev = await requireDeveloper();
  const itemId = String(formData.get("itemId"));
  const item = await db.feeItem.delete({ where: { id: itemId } });
  await audit({
    actorId: dev.id, action: "system.fee_item_deleted", entityType: "FeeSchedule",
    entityId: item.scheduleId, after: { name: item.name },
  });
  redirect("/admin/fees?saved=1");
}

// ─── Users & roles ───

// Local auth instance WITHOUT the nextCookies plugin: creating an account for
// someone else must not replace the signed-in developer's own session cookie.
const adminAuth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});

export async function adminCreateUser(formData: FormData) {
  const dev = await requireDeveloper();
  const back = "/admin/users";
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleCode = String(formData.get("roleCode") ?? "");

  if (name.length < 2) fail(back, "Enter the person's full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(back, "Enter a valid email address.");
  if (password.length < 8) fail(back, "Password must be at least 8 characters.");

  try {
    await adminAuth.api.signUpEmail({ body: { name, email, password } });
  } catch (e) {
    if (e instanceof APIError) fail(back, e.message || "Could not create the account.");
    throw e;
  }
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  if (roleCode) {
    const role = await db.role.findUnique({ where: { code: roleCode } });
    if (role) {
      await db.roleAssignment.create({ data: { userId: user.id, roleId: role.id } });
    }
  }
  await audit({
    actorId: dev.id, action: "system.user_created", entityType: "User",
    entityId: user.id, after: { email, roleCode },
  });
  redirect(`${back}?saved=1`);
}

export async function assignRole(formData: FormData) {
  const dev = await requireDeveloper();
  const userId = String(formData.get("userId"));
  const roleCode = String(formData.get("roleCode"));

  const role = await db.role.findUniqueOrThrow({ where: { code: roleCode } });
  const existing = await db.roleAssignment.findFirst({ where: { userId, roleId: role.id } });
  if (!existing) {
    await db.roleAssignment.create({ data: { userId, roleId: role.id } });
    await audit({
      actorId: dev.id, action: "system.role_assigned", entityType: "User",
      entityId: userId, after: { roleCode },
    });
  }
  redirect("/admin/users?saved=1");
}

export async function revokeRole(formData: FormData) {
  const dev = await requireDeveloper();
  const userId = String(formData.get("userId"));
  const roleCode = String(formData.get("roleCode"));

  if (userId === dev.id && roleCode === ROLES.DEVELOPER) {
    fail("/admin/users", "You can't revoke your own developer role — that would lock you out.");
  }

  const role = await db.role.findUniqueOrThrow({ where: { code: roleCode } });
  await db.roleAssignment.deleteMany({ where: { userId, roleId: role.id } });
  await audit({
    actorId: dev.id, action: "system.role_revoked", entityType: "User",
    entityId: userId, after: { roleCode },
  });
  redirect("/admin/users?saved=1");
}
