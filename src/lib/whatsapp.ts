import "server-only";
import { getSetting, SETTING_KEYS } from "@/lib/settings";

/**
 * Outbound WhatsApp adapter. Hubtel doesn't publish a general-purpose
 * WhatsApp send API today, so this targets the common "Bearer key + JSON
 * POST" shape shared by WhatsApp Business gateways (Meta Cloud API proxies,
 * Twilio-compatible providers, etc.) — same generic contract the SMS gateway
 * used before it was dialled in for Hubtel specifically. Adjust the body
 * below to match whichever provider is configured; nothing else in the app
 * needs to change. Falls back to logging to the console when unconfigured.
 */
export async function sendWhatsApp(params: {
  to: string;
  message: string;
}): Promise<{ sent: boolean }> {
  const url = await getSetting(SETTING_KEYS.WHATSAPP_API_URL);
  const key = await getSetting(SETTING_KEYS.WHATSAPP_API_KEY);
  const sender = await getSetting(SETTING_KEYS.WHATSAPP_SENDER);

  if (!url || !key || !sender) {
    console.log(
      `[whatsapp] no WHATSAPP_API_URL/WHATSAPP_API_KEY/WHATSAPP_SENDER — WhatsApp message not sent.\n` +
        `  to: ${params.to}\n  message: ${params.message}`
    );
    return { sent: false };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: params.to,
        from: sender,
        type: "text",
        text: { body: params.message },
        message: params.message,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[whatsapp] gateway error ${res.status}: ${body.slice(0, 300)}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("[whatsapp] send failed:", e);
    return { sent: false };
  }
}
