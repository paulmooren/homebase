import { appendFile } from "node:fs/promises";
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "Nest <noreply@getnest.eu>";

type Email = { to: string; subject: string; text: string; html: string };

/**
 * Sends through Resend. Without RESEND_API_KEY (local development only) nothing is sent: the message is logged and
 * appended to .email-outbox.jsonl, so sign-up and reset links can be followed (and tested) without a real inbox.
 * In production a missing key is an error rather than a silently swallowed email.
 */
export async function sendEmail(email: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.log(`[email, not sent] to ${email.to}: ${email.subject}\n${email.text}`);
    await appendFile(".email-outbox.jsonl", JSON.stringify({ ...email, at: new Date().toISOString() }) + "\n");
    return;
  }
  const { error } = await new Resend(key).emails.send({ from: FROM, ...email });
  if (error) throw new Error(`Resend refused the email: ${error.message}`);
}

/** The one layout every account email uses: a heading, a sentence, one button, a plain-link fallback. */
export function accountEmail(opts: { subject: string; heading: string; intro: string; button: string; url: string }) {
  const { subject, heading, intro, button, url } = opts;
  const ignore = "If you didn't ask for this, you can ignore this email — nothing will change.";
  const text = `${heading}\n\n${intro}\n\n${button}: ${url}\n\n${ignore}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b">
<div style="max-width:440px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border-radius:16px;padding:32px 28px">
<div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:9px;background:#18181b;color:#ffffff;font-weight:700">N</div>
<h1 style="font-size:22px;margin:20px 0 8px">${heading}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 24px;color:#3f3f46">${intro}</p>
<a href="${url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px">${button}</a>
<p style="font-size:12.5px;line-height:1.5;margin:24px 0 0;color:#71717a">Or paste this link into your browser:<br><span style="word-break:break-all">${url}</span></p>
<p style="font-size:12.5px;line-height:1.5;margin:16px 0 0;color:#71717a">${ignore}</p>
</div></div></body></html>`;
  return { subject, text, html };
}
