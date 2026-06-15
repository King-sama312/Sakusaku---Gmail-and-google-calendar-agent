import { Resend } from "resend";
import { env } from "../env";

const resend = new Resend(env.RESEND_API_KEY);

const FROM = "onboarding@resend.dev";

export async function sendVerificationEmail(to: string, token: string, userId: string) {
  const link = `${env.FRONTEND_URL}/verify-email?token=${token}&userId=${userId}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your email address",
    html: `
      <h2>Welcome to Sakusaku!</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">
        Verify email
      </a>
      <p style="margin-top:16px;color:#666;font-size:14px;">
        This link expires in 1 hour.
      </p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your password",
    html: `
      <h2>Reset your password</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">
        Reset password
      </a>
      <p style="margin-top:16px;color:#666;font-size:14px;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    `,
  });
}
