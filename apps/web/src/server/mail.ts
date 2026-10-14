/**
 * Outgoing email over SMTP (any provider: Gmail with an app password, Resend, SendGrid,
 * Postmark, Amazon SES…). In development without SMTP settings, messages are printed
 * to the server console instead so links can still be followed.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email sending isn't configured on this server (SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM).");
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
  return !!(env.mail.host && env.mail.user && env.mail.pass && env.mail.from);
}

export async function sendMail(msg: MailMessage): Promise<void> {
  if (process.env.VITEST) {
    outbox.push(msg);
    return;
  }
  if (!mailConfigured()) {
    if (env.isProduction) throw new MailNotConfiguredError();
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
  await transporter.sendMail({ from: env.mail.from!, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
}
