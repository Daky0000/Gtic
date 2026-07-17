"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(error.message ?? "Sign-in failed. Check your email and password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="scr mx-auto max-w-[440px] px-7 py-[72px]">
      <h1 className="mb-3 font-serif text-[38px] font-normal">Sign in</h1>
      <p className="mb-7 text-[15px] leading-[1.6] text-muted">
        One account for every portal — applicant, student, staff and administration. New applicant?{" "}
        <Link href="/signup" className="text-forest hover:text-moss">
          Start your application
        </Link>
        .
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
        <label className="text-[13px] text-muted">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="field mt-[7px]"
          />
        </label>

        <p className="-mt-2 text-right text-[13px]">
          <Link href="/forgot-password" className="text-forest hover:text-moss">
            Forgot password?
          </Link>
        </p>

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
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-7 border-t border-line pt-6">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
          New applicant?
        </div>
        <Link
          href="/signup"
          className="inline-flex rounded-xl border border-line bg-paper px-[14px] py-[11px] text-[13px] text-ink transition-colors hover:border-forest"
        >
          Start your application →
        </Link>
      </div>
    </div>
  );
}
