"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerApplicant, type SignupState } from "@/lib/actions/account";

export default function SignupPage() {
  const [state, action, pending] = useActionState<SignupState, FormData>(registerApplicant, null);

  const field =
    "mt-1 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-bold">Create your applicant account</h1>
      <p className="mt-1 text-sm text-ink-500">
        Start your application in minutes. Already have an account?{" "}
        <Link href="/login" className="text-brand-800 underline">Sign in</Link>.
      </p>

      <form action={action} className="mt-8 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-ink-700">Full name</label>
          <input id="name" name="name" required autoComplete="name" className={field} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-700">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={field} />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-700">Password</label>
          <input
            id="password" name="password" type="password" required minLength={8}
            autoComplete="new-password" className={field}
          />
          <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
        </div>

        {state?.error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-800 px-4 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Create account & start applying"}
        </button>
      </form>

      <p className="mt-6 text-xs text-ink-500">
        Staff and student accounts are issued by the university — this page is for new applicants only.
      </p>
    </div>
  );
}
