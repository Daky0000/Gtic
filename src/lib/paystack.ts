import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSetting, SETTING_KEYS } from "@/lib/settings";

/**
 * Paystack adapter (cards + MTN/Telecel/AT mobile money, GHS).
 * The secret key comes from the developer console setting (DB) with the
 * PAYSTACK_SECRET_KEY env var as fallback; when neither is set the payment
 * layer falls back to the instant mock — the same adapter+fallback pattern
 * as the AI provider. Amounts are pesewas throughout (Paystack's GHS subunit
 * matches the app's storage unit, no conversion needed).
 */

const API_BASE = "https://api.paystack.co";

async function getSecretKey(): Promise<string | null> {
  // Trim defensively: a key pasted into an env var or the console can carry a
  // trailing space/newline that makes Paystack reject every request as
  // "Invalid key" — the trim removes that whole class of failure.
  const raw = await getSetting(SETTING_KEYS.PAYSTACK_SECRET_KEY);
  const trimmed = raw?.trim();
  return trimmed && trimmed !== "" ? trimmed : null;
}

export async function isPaystackConfigured(): Promise<boolean> {
  return !!(await getSecretKey());
}

/**
 * Live diagnostic for the developer console: confirms the configured secret
 * key actually works against Paystack and that the merchant supports GHS.
 * Never throws — returns a plain result so the settings page can show the
 * real reason a checkout would fail (invalid key, wrong currency, etc.).
 */
export async function testPaystackConnection(): Promise<{ ok: boolean; message: string }> {
  const key = await getSecretKey();
  if (!key) return { ok: false, message: "No Paystack secret key configured — payments settle on the mock channel." };
  if (!/^sk_(test|live)_/.test(key)) {
    return { ok: false, message: `The configured key starts with "${key.slice(0, 3)}…" — it must be a SECRET key (sk_test_… or sk_live_…), not a public (pk_…) key.` };
  }
  try {
    const res = await fetch(`${API_BASE}/balance`, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean; message?: string; data?: { currency: string; balance: number }[];
    };
    if (!res.ok || !body.status) {
      return { ok: false, message: `Paystack rejected the key: ${body.message ?? res.statusText} (HTTP ${res.status}).` };
    }
    const currencies = (body.data ?? []).map((b) => b.currency);
    const mode = key.startsWith("sk_live_") ? "live" : "test";
    if (currencies.length > 0 && !currencies.includes("GHS")) {
      return {
        ok: false,
        message: `Key is valid (${mode} mode) but this Paystack account supports ${currencies.join(", ")}, not GHS. Checkouts in GHS will fail — use a Ghana Paystack account.`,
      };
    }
    return { ok: true, message: `Connected — ${mode}-mode key valid${currencies.length ? ` for ${currencies.join(", ")}` : ""}. Checkouts will work.` };
  } catch (e) {
    return { ok: false, message: `Could not reach Paystack: ${e instanceof Error ? e.message : "network error"}.` };
  }
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = await getSecretKey();
  if (!key) throw new Error("Paystack secret key is not configured.");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = (await res.json()) as { status: boolean; message?: string; data?: T };
  if (!res.ok || !body.status) {
    throw new Error(`Paystack error: ${body.message ?? res.statusText}`);
  }
  return body.data as T;
}

export async function initializePaystackTransaction(params: {
  email: string;
  /** pesewas */
  amount: number;
  reference: string;
  callbackUrl: string;
}): Promise<{ authorizationUrl: string }> {
  const data = await paystackFetch<{ authorization_url: string }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        amount: params.amount,
        currency: "GHS",
        reference: params.reference,
        callback_url: params.callbackUrl,
        channels: ["card", "mobile_money", "bank_transfer"],
      }),
    }
  );
  return { authorizationUrl: data.authorization_url };
}

export async function verifyPaystackTransaction(reference: string): Promise<{
  success: boolean;
  /** pesewas actually charged */
  amount: number;
  channel: string | null;
}> {
  const data = await paystackFetch<{ status: string; amount: number; channel?: string }>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
  return {
    success: data.status === "success",
    amount: data.amount,
    channel: data.channel ?? null,
  };
}

/** Pure signature check (unit-tested): x-paystack-signature is HMAC-SHA512
 * of the raw body, compared in constant time. */
export function paystackSignatureMatches(
  rawBody: string,
  signature: string | null,
  key: string | null
): boolean {
  if (!signature || !key) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook authenticity against the configured secret key. */
export async function isValidPaystackSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  return paystackSignatureMatches(rawBody, signature, await getSecretKey());
}
