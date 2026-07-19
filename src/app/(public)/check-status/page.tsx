import Link from "next/link";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_LABEL } from "@/lib/status-labels";

export const metadata = { title: "Check Application Status" };

export default async function CheckStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; surname?: string }>;
}) {
  const { ref, surname } = await searchParams;
  // The reference alone is a guessable 6-digit code, so status (and the
  // letter link) is only revealed when the surname on the application ALSO
  // matches — a bot enumerating references learns nothing. Stored refs are
  // mixed-case (they embed the cycle name, e.g. APP-September-062347), so
  // both fields match case-insensitively.
  const app =
    ref && surname?.trim()
      ? await db.application.findFirst({
          where: {
            refNo: { equals: ref.trim(), mode: "insensitive" },
            surname: { equals: surname.trim(), mode: "insensitive" },
          },
          include: { offer: true },
        })
      : null;

  return (
    <div className="scr mx-auto max-w-[520px] px-7 py-16">
      <div className="mb-3 eyebrow">Applicant lookup</div>
      <h1 className="mb-3 font-serif text-[38px] font-normal">
        Check application <em className="text-forest">status.</em>
      </h1>
      <p className="mb-6 text-[15px] leading-[1.6] text-muted">
        Enter your application reference number and the surname on the
        application. No login required.
      </p>

      <form className="flex flex-col gap-[10px]">
        <input
          name="ref"
          defaultValue={ref}
          required
          placeholder="e.g. APP-September-123456"
          className="field"
        />
        <div className="flex gap-[10px]">
          <input
            name="surname"
            defaultValue={surname}
            required
            autoComplete="family-name"
            placeholder="Surname on the application"
            className="field flex-1"
          />
          <button
            type="submit"
            className="rounded-xl bg-forest px-6 text-[14px] font-medium text-white transition-colors hover:bg-forest-deep"
          >
            Check
          </button>
        </div>
      </form>

      {ref && (
        <div className="mt-6 card p-6">
          {!app ? (
            <p className="text-sm text-[#b23a2e]">
              No application matches that reference number and surname. Check
              both and try again — the surname must be exactly as entered on
              the application form.
            </p>
          ) : (
            <>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
                Reference {app.refNo}
              </div>
              <div className="mt-2 font-serif text-[24px] text-ink">
                {APPLICATION_STATUS_LABEL[app.status]}
              </div>
              {app.offer && (
                <Link
                  href={`/verify/${app.offer.letterCode}`}
                  className="mt-3 inline-block text-sm text-forest hover:text-moss"
                >
                  Verify admission letter →
                </Link>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-8 rounded-[14px] border border-gold/30 bg-[#f6efdf] p-4 text-xs leading-relaxed text-[#7a5a22]">
        <strong>Fraud warning:</strong> the Center never asks for payment to a private account, and
        every genuine admission letter carries a code you can verify here.
      </div>
    </div>
  );
}
