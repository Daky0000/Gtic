import "server-only";

/**
 * Outbound SMS adapter. Sends via a generic HTTP SMS gateway when configured
 * (SMS_API_URL + SMS_API_KEY + SMS_SENDER — works with Ghana providers like
 * Hubtel/mNotify/Arkesel that accept a simple JSON or form POST); otherwise
 * logs the message to the server console so flows that depend on SMS stay
 * testable before a provider is wired up.
 *
 * The request shape below is the common "to / from / content + Bearer key"
 * form. Providers vary — adjust the body/headers here to match yours; nothing
 * else in the app needs to change.
 */
export async function sendSMS(params: {
  to: string;
  message: string;
}): Promise<{ sent: boolean }> {
  const url = process.env.SMS_API_URL;
  const key = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER;

  if (!url || !key || !sender) {
    console.log(
      `[sms] no SMS_API_URL/SMS_API_KEY/SMS_SENDER — SMS not sent.\n` +
        `  to: ${params.to}\n  message: ${params.message}`
    );
    return { sent: false };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: params.to, from: sender, sender, content: params.message, message: params.message }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[sms] gateway error ${res.status}: ${body.slice(0, 300)}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("[sms] send failed:", e);
    return { sent: false };
  }
}
