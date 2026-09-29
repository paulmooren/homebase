import { Resend } from "resend";

/**
 * Auth.js hands us a raw sign-in URL with no branding of its own — this replaces
 * the library's default template so the very first thing a user sees from Kontor
 * matches the product rather than a generic Auth.js email.
 */
export async function sendMagicLinkEmail(params: {
  to: string;
  url: string;
  host: string;
}) {
  const { to, url, host } = params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = `
  <div style="background:#f4f4f5;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:20px;padding:32px;">
      <div style="width:34px;height:34px;border-radius:10px;background:#18181b;display:flex;align-items:center;justify-content:center;margin-bottom:24px;">
        <span style="color:#ffffff;font-size:19px;font-style:italic;font-family:Georgia,serif;line-height:34px;padding-left:11px;">K</span>
      </div>
      <p style="color:#71717a;font-size:11px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;margin:0 0 12px;">Sign in</p>
      <h1 style="color:#18181b;font-size:22px;font-weight:600;margin:0 0 12px;">Sign-in link for Kontor</h1>
      <p style="color:#71717a;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Click the button below to sign in to <strong style="color:#18181b;">${host}</strong>.
        This link is valid for 24 hours and can only be used once.
      </p>
      <a href="${url}" style="display:inline-block;background:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:11px;">
        Sign in now
      </a>
      <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin:24px 0 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>`;

  const text = `Sign-in link for Kontor\n\nClick the following link to sign in to ${host} (valid for 24 hours):\n${url}\n\nIf you didn't request this, you can safely ignore this email.`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Kontor <onboarding@resend.dev>",
    to,
    subject: `Sign in to ${host}`,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }
}
