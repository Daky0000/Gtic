"use client";

import { useActionState } from "react";
import Link from "next/link";
import { startApplicationWithPayment, type SignupState } from "@/lib/actions/account";

export function SignupForm({ feeLabel, intro }: { feeLabel: string; intro?: string | null }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(startApplicationWithPayment, null);

  return (
    <div className="scr mx-auto max-w-[560px] px-7 py-16">
      <div className="mb-3 eyebrow">Admissions · Year-round intake</div>
      <h1 className="mb-3 font-serif text-[38px] font-normal">
        Begin your <em className="text-forest">application.</em>
      </h1>
      {intro && <p className="mb-4 text-[15px] leading-[1.6] text-ink">{intro}</p>}
      <p className="mb-7 text-[15px] leading-[1.6] text-muted">
        Enter your details and pay the {feeLabel} application voucher with Paystack (card or mobile
        money) to register. Your account is created once payment is confirmed — then sign in with the
        email and password below to complete your application. Already registered?{" "}
        <Link href="/login" className="text-forest hover:text-moss">
          Sign in
        </Link>
        .
      </p>

      <form action={action} className="flex flex-col gap-[14px]">
        <label className="text-[13px] text-muted">
          Full name
          <input name="name" required autoComplete="name" placeholder="Ama Boateng" className="field mt-[7px]" />
        </label>
        <label className="text-[13px] text-muted">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="field mt-[7px]"
          />
        </label>
        <label className="text-[13px] text-muted">
          Phone number
          <input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+233 24 …"
            className="field mt-[7px]"
          />
        </label>
        <div className="grid gap-[14px] sm:grid-cols-2">
          <label className="text-[13px] text-muted">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="field mt-[7px]"
            />
          </label>
          <label className="text-[13px] text-muted">
            Confirm password
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Repeat your password"
              className="field mt-[7px]"
            />
          </label>
        </div>
        <p className="text-xs text-faint">
          You&apos;ll sign in with this email and password after payment — keep them safe. You&apos;ll
          also receive a voucher Serial and PIN by SMS as proof of purchase.
        </p>

        {state?.error && (
          <p role="alert" className="text-[13px] text-[#b23a2e]">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 w-full rounded-xl bg-forest py-[15px] text-[15px] font-medium text-white transition-colors hover:bg-forest-deep disabled:opacity-60"
        >
          {pending ? "Starting secure checkout…" : `Pay ${feeLabel} to register`}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-faint">
        Staff and trainee accounts are issued by the Center — this page is for new applicants only.
      </p>
    </div>
  );
}
