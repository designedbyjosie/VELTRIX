/** Transactional email templates. Plain, brand-consistent, no tracking pixels. */
import { env } from "./env";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#050B18;font-family:Inter,Arial,sans-serif;color:#F4F7FF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#0D1B31;border:1px solid #19365A;border-radius:16px"><tr><td style="padding:28px">
<p style="margin:0 0 20px;letter-spacing:.32em;font-size:13px;color:#F4F7FF">VELTRIX</p>
<h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#C5D2E8">${esc(p)}</p>`).join("")}
${action ? `<p style="margin:20px 0"><a href="${esc(action.url)}" style="display:inline-block;background:#2878FF;background-image:linear-gradient(100deg,#2878FF,#7954FF);color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">${esc(action.label)}</a></p>
<p style="margin:0;font-size:12px;color:#647896">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(action.url)}</span></p>` : ""}
</td></tr></table>
<p style="font-size:11px;color:#647896;margin-top:16px">You're receiving this because of activity on your VELTRIX account.</p>
</td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs, ...(action ? ["", `${action.label}: ${action.url}`] : [])].join("\n");
  return { html, text };
}

const link = (path: string) => `${env.appUrl.replace(/\/$/, "")}${path}`;

export function verifyEmailMessage(to: string, name: string, token: string) {
  return {
    to,
    subject: "Confirm your email for VELTRIX",
    ...layout(`Welcome, ${name}`, ["Confirm your email address to finish setting up your VELTRIX account. This link expires in 24 hours."], { label: "Confirm email", url: link(`/verify-email?token=${token}`) }),
  };
}

export function resetPasswordMessage(to: string, token: string) {
  return {
    to,
    subject: "Reset your VELTRIX password",
    ...layout("Reset your password", ["Someone asked to reset the password for this VELTRIX account. If it was you, use the button below — it expires in 1 hour and works once.", "If you didn't ask for this, you can ignore this email; your password won't change."], {
      label: "Choose a new password",
      url: link(`/reset-password?token=${token}`),
    }),
  };
}

export function securityAlertMessage(to: string, event: string, detail: string) {
  return {
    to,
    subject: `VELTRIX security alert: ${event}`,
    ...layout(event, [detail, "If this wasn't you, reset your password immediately and review Settings → Security."], { label: "Review security settings", url: link("/app/settings#security") }),
  };
}
