import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  getOrCreateDraftApplication, isApplicationFeeCleared, withdrawApplication,
} from "@/lib/actions/admissions";
import { readTempPasswordCookie } from "@/lib/actions/account";
import { APPLICATION_STATUS_COLOR, APPLICATION_STATUS_LABEL } from "@/lib/status-labels";
import { AnnouncementsBanner } from "@/components/announcements-banner";
import { Flash } from "@/components/flash";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Applicant Portal" };

export default async function ApplyHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; withdrawn?: string }>;
}) {
  const user = await requirePortal("apply");
  const { error, withdrawn } = await searchParams;
  const app = await getOrCreateDraftApplication(user.id);
  const tempCredentials = await readTempPasswordCookie();

  const checklist = app
    ? await buildChecklist(app.id, user.id, app.cycleId)
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      <Flash error={error} success={withdrawn ? "Your application was withdrawn back to draft — you can edit and resubmit it." : undefined} />

      {tempCredentials && tempCredentials.email === user.email && (
        <div className="mt-4 rounded-lg border-2 border-brand-300 bg-brand-50 p-4">
          <h2 className="font-semibold text-brand-900">Your account is ready — save these details</h2>
          <p className="mt-1 text-xs text-brand-800">
            Your payment created this login. It&apos;s shown once here and won&apos;t be shown again —
            write it down or copy it now.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="w-20 text-brand-700">Email</dt>
              <dd className="font-mono">{tempCredentials.email}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="w-20 text-brand-700">Password</dt>
              <dd className="font-mono font-semibold">{tempCredentials.password}</dd>
              <CopyButton value={tempCredentials.password} />
            </div>
          </dl>
        </div>
      )}

      <div className="mt-4"><AnnouncementsBanner audience="APPLICANTS" /></div>

      {!app ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          There is no admission cycle open for applications right now. Please check back later.
        </p>
      ) : (
        <div className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-ink-500">Reference number</div>
              <div className="font-mono text-lg font-semibold">{app.refNo}</div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${APPLICATION_STATUS_COLOR[app.status]}`}
            >
              {APPLICATION_STATUS_LABEL[app.status]}
            </span>
          </div>

          {app.status === "INFO_REQUESTED" && app.infoRequest && (
            <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              <strong>The admissions office needs more information:</strong> {app.infoRequest}
            </div>
          )}

          {checklist && ["DRAFT", "INFO_REQUESTED"].includes(app.status) && (
            <div className="mt-5 rounded-md border border-ink-200 bg-ink-50/60 p-4">
              <h2 className="text-sm font-semibold text-ink-700">Before you can submit</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        item.done ? "bg-brand-800 text-white" : "border border-ink-300 text-ink-400"
                      }`}
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <Link href={item.href} className={item.done ? "text-ink-500 line-through" : "text-ink-700 hover:underline"}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/apply/application"
              className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {["DRAFT", "INFO_REQUESTED"].includes(app.status) ? "Continue application" : "View application"}
            </Link>
            <Link
              href="/apply/documents"
              className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              Documents
            </Link>
            <Link
              href="/apply/payments"
              className="rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              Payments
            </Link>
            {(app.status === "OFFER_ISSUED" || app.status === "ACCEPTED") && (
              <Link
                href="/apply/letter"
                className="rounded-md border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100"
              >
                View admission letter
              </Link>
            )}
          </div>

          {["SUBMITTED", "UNDER_REVIEW"].includes(app.status) && (
            <form action={withdrawApplication} className="mt-4 border-t border-ink-100 pt-3">
              <input type="hidden" name="applicationId" value={app.id} />
              <button
                type="submit"
                className="text-xs text-ink-500 underline hover:text-red-700"
              >
                Withdraw application (returns it to draft for editing)
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        Tip: ask the assistant (bottom-right) &ldquo;What are the entry requirements for Solar Energy
        Engineering?&rdquo;
      </div>
    </div>
  );
}

async function buildChecklist(applicationId: string, userId: string, cycleId: string) {
  const [app, docCount, feeCleared] = await Promise.all([
    db.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: { choices: true },
    }),
    db.applicationDocument.count({ where: { applicationId } }),
    isApplicationFeeCleared(applicationId, userId, cycleId),
  ]);
  const results = (app.results as unknown[] | null) ?? [];
  return [
    { label: "Fill in your personal details", href: "/apply/application", done: !!(app.surname && app.firstName && app.dateOfBirth) },
    { label: "Enter your examination results", href: "/apply/application", done: results.length > 0 },
    { label: "Choose your programmes", href: "/apply/application", done: app.choices.length > 0 },
    { label: "Upload supporting documents", href: "/apply/documents", done: docCount > 0 },
    { label: "Pay the application fee", href: "/apply/payments", done: feeCleared },
    { label: "Submit your application", href: "/apply/application", done: false },
  ];
}
