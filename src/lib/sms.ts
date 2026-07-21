import "server-only";
import { getSetting, SETTING_KEYS } from "@/lib/settings";

/** Hubtel requires international format with no "+" (e.g. "233241234567") —
 * the rest of the app collects Ghana-local numbers like "0241234567". */
function toHubtelPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `233${digits.slice(1)}`;
  return digits;
}

/**
 * Outbound SMS via Hubtel's Quick Send API
 * (https://smsc.hubtel.com/v1/messages/send) — POST with HTTP Basic auth
 * (ClientId:ClientSecret, base64) and From/To/Content query params. Falls
 * back to logging the message to the server console when Hubtel isn't
 * configured, so SMS-dependent flows stay testable before it's wired up.
 */
export async function sendSMS(params: {
  to: string;
  message: string;
}): Promise<{ sent: boolean }> {
  const clientId = await getSetting(SETTING_KEYS.HUBTEL_SMS_CLIENT_ID);
  const clientSecret = await getSetting(SETTING_KEYS.HUBTEL_SMS_CLIENT_SECRET);
  const sender = await getSetting(SETTING_KEYS.HUBTEL_SMS_SENDER_ID);

  if (!clientId || !clientSecret || !sender) {
    console.log(
      `[sms] Hubtel not configured (HUBTEL_SMS_CLIENT_ID/SECRET/SENDER_ID) — SMS not sent.\n` +
        `  to: ${params.to}\n  message: ${params.message}`
    );
    return { sent: false };
  }

  const url = new URL("https://smsc.hubtel.com/v1/messages/send");
  url.searchParams.set("From", sender);
  url.searchParams.set("To", toHubtelPhone(params.to));
  url.searchParams.set("Content", params.message);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[sms] Hubtel error ${res.status}: ${body.slice(0, 300)}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("[sms] Hubtel send failed:", e);
    return { sent: false };
  }
}
