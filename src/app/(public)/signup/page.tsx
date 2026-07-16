"use client";

import { useActionState } from "react";
import Link from "next/link";
import { startApplicationWithPayment, type SignupState } from "@/lib/actions/account";

export default function SignupPage() {
  const [state, action, pending] = useActionState<SignupState, FormData>(startApplicationWithPayment, null);

  return (
    <div className="scr mx-auto max-w-[560px] px-7 py-16">
      <div className="mb-3 eyebrow">Admissions · Year-round intake</div>
      <h1 className="mb-3 font-serif text-[38px] font-normal">
        Begin your <em className="text-forest">application.</em>
      </h1>
      <p className="mb-7 text-[15px] leading-[1.6] text-muted">
        Pay the application voucher fee to create your account — we&apos;ll set up your login for
        you. Already applying?{" "}
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
          <span className="mt-[6px] block text-xs text-faint">
            Your login details will be shown here once payment is confirmed.
          </span>
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
          {pending ? "Setting up your account…" : "Pay voucher fee & continue"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-faint">
        Staff and trainee accounts are issued by the Center — this page is for new applicants only.
      </p>
    </div>
  );
}
