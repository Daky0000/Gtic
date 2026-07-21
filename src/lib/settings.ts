import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { parseProcessingFeePercent } from "@/lib/money";

/**
 * System settings managed from the developer portal (/developer/settings).
 * A DB value overrides the corresponding environment variable at runtime, so
 * integrations can be reconfigured without a redeploy; deleting the DB value
 * falls back to the env var. Secrets are stored verbatim (single-tenant demo
 * scope) and only ever surfaced masked.
 */

export const SETTING_KEYS = {
  PAYSTACK_SECRET_KEY: "integration.paystack_secret_key",
  /** Paystack PUBLIC key (pk_test_… / pk_live_…). Safe to expose to the
   * browser — only needed for inline/popup checkout; hosted checkout uses
   * the secret key server-side. Stored so both keys live in one place. */
  PAYSTACK_PUBLIC_KEY: "integration.paystack_public_key",
  ANTHROPIC_API_KEY: "integration.anthropic_api_key",
  AI_PROVIDER: "integration.ai_provider",
  DOC_FEE_TRANSCRIPT: "fees.document.transcript",
  DOC_FEE_ATTESTATION: "fees.document.attestation",
  DOC_FEE_VERIFICATION_LETTER: "fees.document.verification_letter",
  LIBRARY_FINE_PER_DAY: "fees.library.fine_per_day",
  /** Developer-set USD→GHS multiplier (e.g. "15.50"). When present, fee
   * inputs on the fees console accept USD and convert at this rate —
   * Paystack Ghana settles in GHS only, so USD pricing needs it. */
  USD_TO_GHS_RATE: "pricing.usd_to_ghs_rate",
  /** Developer-set percentage added on top of a fee only at the moment a
   * real Paystack checkout is started (never on the sticker price shown
   * while browsing/applying) — see applyProcessingFee in money.ts. Defaults
   * to 1 when unset. */
  PROCESSING_FEE_PERCENT: "pricing.processing_fee_percent",
  HUBTEL_SMS_CLIENT_ID: "integration.hubtel_sms_client_id",
  HUBTEL_SMS_CLIENT_SECRET: "integration.hubtel_sms_client_secret",
  HUBTEL_SMS_SENDER_ID: "integration.hubtel_sms_sender_id",
  /** Generic WhatsApp Business gateway (Hubtel doesn't publish a public
   * WhatsApp API today) — same "Bearer key + JSON POST" shape as the old
   * generic SMS gateway, so any provider that fits it can be dropped in. */
  WHATSAPP_API_URL: "integration.whatsapp_api_url",
  WHATSAPP_API_KEY: "integration.whatsapp_api_key",
  WHATSAPP_SENDER: "integration.whatsapp_sender",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Env var that backs each setting when no DB override exists. */
const ENV_FALLBACK: Partial<Record<SettingKey, string>> = {
  [SETTING_KEYS.PAYSTACK_SECRET_KEY]: "PAYSTACK_SECRET_KEY",
  [SETTING_KEYS.PAYSTACK_PUBLIC_KEY]: "PAYSTACK_PUBLIC_KEY",
  [SETTING_KEYS.ANTHROPIC_API_KEY]: "ANTHROPIC_API_KEY",
  [SETTING_KEYS.AI_PROVIDER]: "AI_PROVIDER",
  [SETTING_KEYS.HUBTEL_SMS_CLIENT_ID]: "HUBTEL_SMS_CLIENT_ID",
  [SETTING_KEYS.HUBTEL_SMS_CLIENT_SECRET]: "HUBTEL_SMS_CLIENT_SECRET",
  [SETTING_KEYS.HUBTEL_SMS_SENDER_ID]: "HUBTEL_SMS_SENDER_ID",
  [SETTING_KEYS.WHATSAPP_API_URL]: "WHATSAPP_API_URL",
  [SETTING_KEYS.WHATSAPP_API_KEY]: "WHATSAPP_API_KEY",
  [SETTING_KEYS.WHATSAPP_SENDER]: "WHATSAPP_SENDER",
};

export async function getSetting(key: SettingKey): Promise<string | null> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  if (row && row.value !== "") return row.value;
  const envName = ENV_FALLBACK[key];
  const envValue = envName ? process.env[envName] : undefined;
  return envValue && envValue !== "" ? envValue : null;
}

/** Non-null when the value comes from the DB (i.e. set via the console). */
export async function getSettingOverride(key: SettingKey): Promise<string | null> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  return row && row.value !== "" ? row.value : null;
}

export async function setSetting(key: SettingKey, value: string, actorId: string) {
  const trimmed = value.trim();
  if (trimmed === "") {
    await db.systemSetting.deleteMany({ where: { key } });
  } else {
    await db.systemSetting.upsert({
      where: { key },
      update: { value: trimmed, updatedById: actorId },
      create: { key, value: trimmed, updatedById: actorId },
    });
  }
  await audit({
    actorId,
    action: trimmed === "" ? "system.setting_cleared" : "system.setting_changed",
    entityType: "SystemSetting",
    entityId: key,
    // Never write secret values into the audit trail — the key name suffices.
  });
}

/** Developer-set checkout processing-fee percentage — defaults to 1 when
 * never configured. Only ever applied at the moment a real Paystack charge
 * is initiated (see beginInvoicePayment / startApplicationWithPayment). */
export async function getProcessingFeePercent(): Promise<number> {
  const raw = await getSetting(SETTING_KEYS.PROCESSING_FEE_PERCENT);
  return parseProcessingFeePercent(raw) ?? 1;
}

export async function getIntFee(key: SettingKey, fallbackPesewas: number): Promise<number> {
  const raw = await getSetting(key);
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : fallbackPesewas;
}

/** "sk_live_abc…wxyz" → "sk_l…wxyz" for display. */
export function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
