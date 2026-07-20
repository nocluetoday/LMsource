import { Resend } from "resend";

interface EmailArgs {
  to: string;
  subject: string;
  text: string;
}

// Sends via Resend when RESEND_API_KEY is set; otherwise logs to the server
// console so auth flows (verification, password reset) work in local dev.
export async function sendEmail({ to, subject, text }: EmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`\n--- email (dev fallback) ---\nto: ${to}\nsubject: ${subject}\n${text}\n---\n`);
    return;
  }
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "LMSource <onboarding@resend.dev>";
  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) throw new Error(`email send failed: ${error.message}`);
}
