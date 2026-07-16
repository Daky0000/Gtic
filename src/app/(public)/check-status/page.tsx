import Link from "next/link";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_LABEL } from "@/lib/status-labels";

export const metadata = { title: "Check Application Status" };

export default async function CheckStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const app = ref
    ? await db.application.findUnique({
        where: { refNo: ref.trim().toUpperCase() },
        include: { offer: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold">Check application status</h1>
      <p className="mt-1 text-sm text-ink-500">
        Enter your application reference number. No login required.
      </p>

      <form className="mt-6 flex gap-2">
        <input
          name="ref"
          defaultValue={ref}
          placeholder="APP-2026202-123456"
          className="flex-1 rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Check
        </button>
      </form>

      {ref && (
        <div className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
          {!app ? (
            <p className="text-sm text-red-700">No application found with that reference number.</p>
          ) : (
            <>
              <div className="text-sm text-ink-500">Reference {app.refNo}</div>
              <div className="mt-1 text-lg font-semibold">{APPLICATION_STATUS_LABEL[app.status]}</div>
              {app.offer && (
                <Link
                  href={`/verify/${app.offer.letterCode}`}
                  className="mt-3 inline-block text-sm text-brand-800 underline"
                >
                  Verify admission letter →
                </Link>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-8 rounded-md bg-amber-50 p-4 text-xs text-amber-900">
        Fraud warning: the Center never asks for payment to a private account, and every genuine
        admission letter carries a code you can verify here.
      </div>
    </div>
  );
}
