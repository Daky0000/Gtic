"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });
    setBusy(false);
    if (error) {
      setError(error.message ?? "Could not send the reset email. Please try again.");
      return;
    }
    // Always show the same confirmation whether or not the email exists —
    // never confirm which addresses have accounts.
    setDone(true);
  }

  return (
    <div className="scr mx-auto max-w-[440px] px-7 py-[72px]">
      <h1 className="mb-3 font-serif text-[38px] font-normal">Reset password</h1>

      {done ? (
        <p className="text-[15px] leading-[1.6] text-muted">
          If an account exists for <span className="text-forest">{email.trim()}</span>, a reset
          link is on its way. Check your inbox (and spam folder), then follow the link within
          one hour.
        </p>
      ) : (
        <>
          <p className="mb-7 text-[15px] leading-[1.6] text-muted">
            Enter the email you signed up with and we&apos;ll send you a link to choose a new
            password.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="text-[13px] text-muted">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="field mt-[7px]"
              />
            </label>

            {error && (
              <p role="alert" className="text-[13px] text-[#b23a2e]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 w-full rounded-xl bg-forest py-[14px] text-[15px] font-medium text-white transition-colors hover:bg-forest-deep disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-[13px] text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-forest hover:text-moss">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
