/**
 * Outgoing email over SMTP (any provider: Gmail with an app password, Resend, SendGrid,
 * Postmark, Amazon SES…). In development without SMTP settings, messages are printed
 * to the server console instead so links can still be followed.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

/** Names of the settings still needed before email can be sent. */
export function missingMailSettings(): string[] {
  const missing: string[] = [];
  if (!env.mail.user) missing.push("SMTP_USER");
  if (!env.mail.pass) missing.push("SMTP_PASS");
  if (!env.mail.host) missing.push("SMTP_HOST");
  return missing;
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super(`Email sending isn't configured on this server. Missing: ${missingMailSettings().join(", ")}. Add them to the server's environment variables and redeploy.`);
  }
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: Transporter | null = null;
/** Messages captured in tests instead of being sent. */
export const outbox: MailMessage[] = [];

export function mailConfigured() {
  return missingMailSettings().length === 0;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  if (process.env.VITEST) {
    outbox.push(msg);
    return;
  }
  if (!mailConfigured()) {
    if (env.isProduction) {
      const err = new MailNotConfiguredError();
      console.error(`[veltrix] ${err.message}`);
      throw err;
    }
    console.info(`\n[veltrix] Email not configured — would send to ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`);
    return;
  }
  transporter ??= nodemailer.createTransport({
    host: env.mail.host!,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: { user: env.mail.user!, pass: env.mail.pass! },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    await transporter.sendMail({ from: env.mail.from!, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
  } catch (e) {
    // Logged for the operator (e.g. "Invalid login" means the app password is wrong). Never includes the password.
    console.error(`[veltrix] Sending email via ${env.mail.host} as ${env.mail.user} failed: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}
