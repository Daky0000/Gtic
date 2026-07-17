"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({
  token,
  linkError,
}: {
  token: string | null;
  linkError: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidLink = !token || linkError === "INVALID_TOKEN";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setBusy(false);
    if (error) {
      setError(error.message ?? "This reset link is no longer valid. Request a new one.");
      return;
    }
    router.push("/login");
  }

  return (
    <div className="scr mx-auto max-w-[440px] px-7 py-[72px]">
      <h1 className="mb-3 font-serif text-[38px] font-normal">Choose a new password</h1>

      {invalidLink ? (
        <p className="text-[15px] leading-[1.6] text-muted">
          This reset link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="text-forest hover:text-moss">
            Request a new one
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-[13px] text-muted">
            New password
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="field mt-[7px]"
            />
          </label>
          <label className="text-[13px] text-muted">
            Confirm new password
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
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
            {busy ? "Saving…" : "Set new password"}
          </button>
        </form>
      )}
    </div>
  );
}
