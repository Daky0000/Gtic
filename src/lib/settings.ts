import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * System settings managed from the developer console (/admin/settings).
 * A DB value overrides the corresponding environment variable at runtime, so
 * integrations can be reconfigured without a redeploy; deleting the DB value
 * falls back to the env var. Secrets are stored verbatim (single-tenant demo
 * scope) and only ever surfaced masked.
 */

export const SETTING_KEYS = {
  PAYSTACK_SECRET_KEY: "integration.paystack_secret_key",
  ANTHROPIC_API_KEY: "integration.anthropic_api_key",
  AI_PROVIDER: "integration.ai_provider",
  DOC_FEE_TRANSCRIPT: "fees.document.transcript",
  DOC_FEE_ATTESTATION: "fees.document.attestation",
  DOC_FEE_VERIFICATION_LETTER: "fees.document.verification_letter",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Env var that backs each setting when no DB override exists. */
const ENV_FALLBACK: Partial<Record<SettingKey, string>> = {
  [SETTING_KEYS.PAYSTACK_SECRET_KEY]: "PAYSTACK_SECRET_KEY",
  [SETTING_KEYS.ANTHROPIC_API_KEY]: "ANTHROPIC_API_KEY",
  [SETTING_KEYS.AI_PROVIDER]: "AI_PROVIDER",
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
