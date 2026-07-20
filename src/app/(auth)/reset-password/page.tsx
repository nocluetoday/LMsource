"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/auth/client";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      setError("Missing or invalid reset token.");
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.resetPassword({
      newPassword: String(form.get("password")),
      token,
    });
    if (error) {
      setError(error.message ?? "Reset failed");
      setBusy(false);
    } else {
      router.push("/login");
    }
  }

  return (
    <>
      <h1 className="font-serif text-2xl">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input className="field" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        {error && <p className="bg-red-wash px-3 py-2 text-[13px] text-red">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Set password"}
        </button>
      </form>
      <p className="mt-6 text-[13px]">
        <Link href="/login" className="text-ink-soft hover:text-teal">Back to sign in</Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
