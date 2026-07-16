import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  getOrCreateDraftApplication, isApplicationFeeCleared, withdrawApplication,
} from "@/lib/actions/admissions";
import { readTempPasswordCookie } from "@/lib/actions/account";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE } from "@/lib/status-labels";
import { AnnouncementsBanner } from "@/components/announcements-banner";
import { Flash } from "@/components/flash";
import { CopyButton } from "@/components/copy-button";
import { PageHeader, Card, CardLabel, StatusChip, ButtonLink } from "@/components/ui";

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

  const checklist = app ? await buildChecklist(app.id, user.id, app.cycleId) : null;
  const firstName = user.name.split(/\s+/)[0] || user.name;

  return (
    <div className="scr">
      <PageHeader
        title={<>Welcome back, <em className="text-forest">{firstName}.</em></>}
        lead="Track your application, upload documents and complete your enrolment — all in one place."
      />
      <Flash
        error={error}
        success={withdrawn ? "Your application was withdrawn back to draft — you can edit and resubmit it." : undefined}
      />

      {tempCredentials && tempCredentials.email === user.email && (
        <div className="mb-5 rounded-2xl border-2 border-brand-300 bg-[#eaf0ea] p-5">
          <div className="font-serif text-[20px] text-forest-deep">
            Your account is ready — save these details
          </div>
          <p className="mt-1 text-xs text-forest">
            Your payment created this login. It&apos;s shown once here and won&apos;t be shown again —
            write it down or copy it now.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="w-20 text-moss">Email</dt>
              <dd className="font-mono text-ink">{tempCredentials.email}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="w-20 text-moss">Password</dt>
              <dd className="font-mono font-semibold text-ink">{tempCredentials.password}</dd>
              <CopyButton value={tempCredentials.password} />
            </div>
          </dl>
        </div>
      )}

      <div className="mb-5">
        <AnnouncementsBanner audience="APPLICANTS" />
      </div>

      {!app ? (
        <div className="rounded-2xl border border-gold/30 bg-[#f6efdf] p-5 text-sm text-[#7a5a22]">
          There is no admission cycle open for applications right now. Please check back later.
        </div>
      ) : (
        <Card className="!p-0">
          <div className="flex items-center justify-between p-6 pb-5">
            <div>
              <CardLabel>Reference number</CardLabel>
              <div className="font-mono text-[20px] font-semibold text-ink">{app.refNo}</div>
            </div>
            <StatusChip tone={APPLICATION_STATUS_TONE[app.status] ?? "neutral"}>
              {APPLICATION_STATUS_LABEL[app.status]}
            </StatusChip>
          </div>

          {app.status === "INFO_REQUESTED" && app.infoRequest && (
            <div className="mx-6 mb-5 rounded-[11px] bg-[#f3e3d6] p-3 text-sm text-[#a85a2e]">
              <strong>The admissions office needs more information:</strong> {app.infoRequest}
            </div>
          )}

          {checklist && ["DRAFT", "INFO_REQUESTED"].includes(app.status) && (
            <div className="mx-6 mb-5 rounded-[14px] border border-line bg-cream/60 p-5">
              <CardLabel>Before you can submit</CardLabel>
              <ul className="space-y-2 text-sm">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-2.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        item.done ? "bg-forest text-white" : "border border-line text-faint"
                      }`}
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <Link
                      href={item.href}
                      className={item.done ? "text-faint line-through" : "text-ink hover:text-forest"}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3 px-6 pb-6">
            <ButtonLink href="/apply/application">
              {["DRAFT", "INFO_REQUESTED"].includes(app.status) ? "Continue application" : "View application"}
            </ButtonLink>
            <ButtonLink href="/apply/documents" variant="outline">Documents</ButtonLink>
            <ButtonLink href="/apply/payments" variant="outline">Payments</ButtonLink>
            {(app.status === "OFFER_ISSUED" || app.status === "ACCEPTED") && (
              <ButtonLink href="/apply/letter" variant="outline">View admission letter</ButtonLink>
            )}
          </div>

          {["SUBMITTED", "UNDER_REVIEW"].includes(app.status) && (
            <form action={withdrawApplication} className="mx-6 mb-6 border-t border-line-soft pt-3">
              <input type="hidden" name="applicationId" value={app.id} />
              <button type="submit" className="text-xs text-faint underline hover:text-[#b23a2e]">
                Withdraw application (returns it to draft for editing)
              </button>
            </form>
          )}
        </Card>
      )}

      <div className="mt-6 rounded-2xl border border-brand-200 bg-[#eaf0ea] p-4 text-sm text-forest">
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
