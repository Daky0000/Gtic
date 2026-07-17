import "server-only";

/**
 * Outbound email adapter. Uses the Resend HTTP API when RESEND_API_KEY is set
 * (plain fetch — no SDK dependency); otherwise logs the message to the server
 * console so flows that depend on email (password reset) remain testable in
 * dev and on installs that have not configured a sender yet.
 *
 * EMAIL_FROM must be a sender verified with Resend, e.g.
 * "SYDA-GTIC <no-reply@yourdomain>".
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.log(
      `[mailer] no RESEND_API_KEY/EMAIL_FROM — email not sent.\n` +
        `  to: ${params.to}\n  subject: ${params.subject}\n  body:\n${params.text}`
    );
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [params.to], subject: params.subject, text: params.text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mailer] Resend error ${res.status}: ${body.slice(0, 300)}`);
    return { sent: false };
  }
  return { sent: true };
}
