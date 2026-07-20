"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/auth/client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });
    if (error) {
      setError(error.message ?? "Request failed");
      setBusy(false);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <>
        <h1 className="font-serif text-2xl">Check your email</h1>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
          If an account exists for that address, a password-reset link is on its way.
        </p>
        <p className="mt-6 text-[13px]">
          <Link href="/login" className="text-teal hover:text-teal-deep">Back to sign in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-serif text-2xl">Reset password</h1>
      <p className="mt-2 text-[14px] text-ink-soft">
        Enter your account email and we&apos;ll send a reset link.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        {error && <p className="bg-red-wash px-3 py-2 text-[13px] text-red">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-[13px]">
        <Link href="/login" className="text-ink-soft hover:text-teal">Back to sign in</Link>
      </p>
    </>
  );
}
