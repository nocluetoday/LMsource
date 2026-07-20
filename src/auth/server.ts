import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getPool } from "@/db/pool";
import { sendEmail } from "@/email/send";

export const auth = betterAuth({
  database: getPool(),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your LMSource password",
        text: `Click the link below to reset your password:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your LMSource email",
        text: `Welcome to LMSource. Verify your email address:\n\n${url}`,
      });
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
