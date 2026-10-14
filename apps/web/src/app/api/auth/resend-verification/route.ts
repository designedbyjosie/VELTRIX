import { handler } from "@/server/http";
import { sendVerificationEmail } from "@/server/services/auth";
import { MailNotConfiguredError } from "@/server/mail";
import { HttpError } from "@/server/errors";

export const POST = handler({ auth: "session", allowUnverified: true, rateLimit: { key: "resend-verification", limit: 5, windowMs: 60 * 60_000, by: "user" } }, async ({ auth }) => {
  try {
    return await sendVerificationEmail(auth.userId);
  } catch (e) {
    if (e instanceof MailNotConfiguredError) throw new HttpError(503, "mail_not_configured", "Email sending isn't set up on this server yet. Contact the site operator.");
    throw new HttpError(502, "mail_failed", "We couldn't send the email right now. Try again in a few minutes.");
  }
});
