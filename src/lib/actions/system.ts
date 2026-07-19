"use server";

import { redirect } from "next/navigation";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { isDeveloper, requireRole, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/settings";
import { parseUsdRate, usdToPesewas } from "@/lib/money";
import type { ProgrammeLevel } from "@prisma/client";

/** Developer console actions (settings, users). Developer or system admin —
 * the same guard the /admin/settings pages use. */
async function requireDeveloper() {
  return requireRole(ROLES.DEVELOPER, ROLES.SYSTEM_ADMIN);
}

/** Pricing actions are the developer's ALONE — the system admin keeps the
 * rest of the console, but fees and the currency multiplier are excluded. */
async function requireFees() {
  const user = await requireRole(ROLES.DEVELOPER, ROLES.SYSTEM_ADMIN);
  if (!isDeveloper(user)) {
    fail("/admin", "Fees and pricing are managed by the developer account only.");
  }
  return user;
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

/** Amount from a paired GHS/USD input. A non-empty USD value wins and
 * converts at the developer-set multiplier (Paystack Ghana settles GHS
 * only); without a multiplier configured, USD entry is rejected rather than
 * guessed. Returns pesewas, or null when neither field parses. */
async function pairedAmountToPesewas(
  formData: FormData,
  ghsField: string,
  usdField: string
): Promise<number | null> {
  const usdRaw = String(formData.get(usdField) ?? "").trim();
  if (usdRaw !== "") {
    const rate = parseUsdRate(await getSetting(SETTING_KEYS.USD_TO_GHS_RATE));
    if (!rate) {
      fail("/developer/fees", "Set the USD→GHS multiplier before pricing fees in dollars.");
    }
    const usd = Number(usdRaw);
    if (!Number.isFinite(usd) || usd < 0) return null;
    return usdToPesewas(usd, rate);
  }
  return ghsToPesewas(formData.get(ghsField));
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
  const dev = await requireFees();
  const cycleId = String(formData.get("cycleId"));
  const applicationFee = await pairedAmountToPesewas(formData, "applicationFeeGhs", "applicationFeeUsd");
  const acceptanceFee = await pairedAmountToPesewas(formData, "acceptanceFeeGhs", "acceptanceFeeUsd");
  if (applicationFee == null || acceptanceFee == null) {
    fail("/developer/fees", "Enter valid amounts.");
  }

  await db.admissionCycle.update({
    where: { id: cycleId },
    data: { applicationFee, acceptanceFee },
  });
  await audit({
    actorId: dev.id, action: "system.cycle_fees_updated", entityType: "AdmissionCycle",
    entityId: cycleId, after: { applicationFee, acceptanceFee },
  });
  redirect("/developer/fees?saved=1");
}

export async function updateDocumentFees(formData: FormData) {
  const dev = await requireFees();
  const entries: [string, string, (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]][] = [
    ["transcriptGhs", "transcriptUsd", SETTING_KEYS.DOC_FEE_TRANSCRIPT],
    ["attestationGhs", "attestationUsd", SETTING_KEYS.DOC_FEE_ATTESTATION],
    ["verificationGhs", "verificationUsd", SETTING_KEYS.DOC_FEE_VERIFICATION_LETTER],
  ];
  for (const [ghsField, usdField, key] of entries) {
    const pesewas = await pairedAmountToPesewas(formData, ghsField, usdField);
    if (pesewas == null) fail("/developer/fees", "Enter valid amounts.");
    await setSetting(key, String(pesewas), dev.id);
  }
  redirect("/developer/fees?saved=1");
}

export async function updateShortCourseFee(formData: FormData) {
  const dev = await requireFees();
  const shortCourseId = String(formData.get("shortCourseId"));
  const pesewas = await pairedAmountToPesewas(formData, "feeGhs", "feeUsd");
  if (pesewas == null) fail("/developer/fees", "Enter a valid amount.");
  await db.shortCourse.update({ where: { id: shortCourseId }, data: { feePesewas: pesewas } });
  await audit({
    actorId: dev.id, action: "system.short_course_fee_updated", entityType: "ShortCourse",
    entityId: shortCourseId, after: { feePesewas: pesewas },
  });
  redirect("/developer/fees?saved=1");
}

export async function updateLibraryFine(formData: FormData) {
  const dev = await requireFees();
  const pesewas = await pairedAmountToPesewas(formData, "fineGhs", "fineUsd");
  if (pesewas == null) fail("/developer/fees", "Enter a valid amount.");
  await setSetting(SETTING_KEYS.LIBRARY_FINE_PER_DAY, String(pesewas), dev.id);
  redirect("/developer/fees?saved=1");
}

/** Sets (or clears) the USD→GHS multiplier used to price fees in dollars. */
export async function saveCurrencyRate(formData: FormData) {
  const dev = await requireFees();
  const raw = String(formData.get("rate") ?? "").trim();
  if (raw === "" || formData.get("clear")) {
    await setSetting(SETTING_KEYS.USD_TO_GHS_RATE, "", dev.id);
    redirect("/developer/fees?saved=1");
  }
  const rate = parseUsdRate(raw);
  if (!rate) {
    fail("/developer/fees", "Enter a valid multiplier — how many GHS one US dollar buys, e.g. 15.50.");
  }
  await setSetting(SETTING_KEYS.USD_TO_GHS_RATE, String(rate), dev.id);
  redirect("/developer/fees?saved=1");
}

export async function updateHostelFee(formData: FormData) {
  const dev = await requireFees();
  const hostelId = String(formData.get("hostelId"));
  const feePerYear = await pairedAmountToPesewas(formData, "feeGhs", "feeUsd");
  if (feePerYear == null) fail("/developer/fees", "Enter a valid amount.");

  await db.hostel.update({ where: { id: hostelId }, data: { feePerYear } });
  await audit({
    actorId: dev.id, action: "system.hostel_fee_updated", entityType: "Hostel",
    entityId: hostelId, after: { feePerYear },
  });
  redirect("/developer/fees?saved=1");
}

export async function createFeeSchedule(formData: FormData) {
  const dev = await requireFees();
  const academicYearId = String(formData.get("academicYearId"));
  const level = String(formData.get("level")) as ProgrammeLevel;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("/developer/fees", "Give the fee schedule a name.");

  const existing = await db.feeSchedule.findUnique({
    where: { academicYearId_level: { academicYearId, level } },
  });
  if (existing) fail("/developer/fees", "A schedule for that year and level already exists.");

  await db.feeSchedule.create({ data: { academicYearId, level, name } });
  await audit({ actorId: dev.id, action: "system.fee_schedule_created", entityType: "FeeSchedule" });
  redirect("/developer/fees?saved=1");
}

export async function addFeeItem(formData: FormData) {
  const dev = await requireFees();
  const scheduleId = String(formData.get("scheduleId"));
  const name = String(formData.get("name") ?? "").trim();
  const amount = await pairedAmountToPesewas(formData, "amountGhs", "amountUsd");
  if (!name || amount == null) fail("/developer/fees", "Enter a fee item name and a valid amount.");

  await db.feeItem.create({ data: { scheduleId, name, amount } });
  await audit({
    actorId: dev.id, action: "system.fee_item_added", entityType: "FeeSchedule",
    entityId: scheduleId, after: { name, amount },
  });
  redirect("/developer/fees?saved=1");
}

export async function deleteFeeItem(formData: FormData) {
  const dev = await requireFees();
  const itemId = String(formData.get("itemId"));
  const item = await db.feeItem.delete({ where: { id: itemId } });
  await audit({
    actorId: dev.id, action: "system.fee_item_deleted", entityType: "FeeSchedule",
    entityId: item.scheduleId, after: { name: item.name },
  });
  redirect("/developer/fees?saved=1");
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
