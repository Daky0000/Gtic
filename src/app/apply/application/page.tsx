import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  getOrCreateDraftApplication, saveApplicationDetails, submitApplication, uploadResultsSlipForAI,
} from "@/lib/actions/admissions";
import { reconcilePendingPaystackPayments } from "@/lib/payments";
import { isAdmissionOpen } from "@/lib/intake";
import { Flash } from "@/components/flash";
import { ApplicationWizard, type SchoolGroup } from "./application-wizard";

export const metadata = { title: "My Application" };

const STEP_INDEX: Record<string, number> = { "0": 0, "1": 1, "2": 2, "3": 3 };

export default async function ApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; paid?: string; step?: string; aifilled?: string; aiuploaded?: string }>;
}) {
  const user = await requirePortal("apply");
  const { error, saved, paid, step, aifilled, aiuploaded } = await searchParams;
  const app = await getOrCreateDraftApplication(user.id);
  if (!app) redirect("/apply");

  // This is the page Paystack returns payers to — settle any in-flight
  // checkout here too, so a missed callback/webhook can't strand the voucher.
  await reconcilePendingPaystackPayments(user.id);
  const voucherInvoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "APPLICATION", meta: { path: ["applicationId"], equals: app.id } },
  });
  const voucherPaid = voucherInvoice ? voucherInvoice.paid >= voucherInvoice.total : false;

  const editable = app.status === "DRAFT" || app.status === "INFO_REQUESTED";
  const dbSchools = await db.school.findMany({
    orderBy: { name: "asc" },
    include: { departments: { include: { programmes: { orderBy: { name: "asc" } } } } },
  });
  const choices = await db.applicationChoice.findMany({
    where: { applicationId: app.id },
    orderBy: { rank: "asc" },
  });
  const results = (app.results as { subject: string; grade: string }[] | null) ?? [];

  // Flatten schools → programme options for the wizard (only open programmes
  // are selectable; closed ones render disabled with their reopen label).
  const schools: SchoolGroup[] = dbSchools.map((s) => ({
    id: s.id,
    name: s.name,
    programmes: s.departments.flatMap((d) =>
      d.programmes.map((p) => ({
        id: p.id,
        name: p.name,
        admissionClosesMonth: p.admissionClosesMonth,
        admissionClosesDay: p.admissionClosesDay,
        cohortStartsMonth: p.cohortStartsMonth,
        cohortStartsDay: p.cohortStartsDay,
      }))
    ),
  }));
  const anyProgrammeOpen = schools.some((s) => s.programmes.some((p) => isAdmissionOpen(p)));

  const successMsg = saved
    ? "Your application details were saved."
    : aifilled
      ? `The AI read ${aifilled} subject(s) from your slip and filled your grades — please review them below.`
      : aiuploaded
        ? "Your results slip was uploaded. Enter or check your grades below."
        : paid && voucherPaid
          ? "Voucher payment confirmed — welcome! Complete your application below."
          : undefined;

  // Results-slip AI upload widget rendered inside the wizard's results step.
  const resultsSlipForm = (
    <form action={uploadResultsSlipForAI} encType="multipart/form-data" className="rounded-[14px] border border-brand-200 bg-brand-50 p-4">
      <input type="hidden" name="applicationId" value={app.id} />
      <div className="text-sm font-medium text-brand-900">Upload your results slip for AI to read your grades</div>
      <p className="mt-1 text-xs text-brand-800">
        Upload your WASSCE/results slip (PDF or image) and the AI assistant fills in the subjects and grades
        below for you to confirm — no manual typing needed.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp" className="text-sm" />
        <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
          Upload &amp; auto-fill
        </button>
      </div>
    </form>
  );

  return (
    <div className="scr mx-auto max-w-3xl">
      <h1 className="font-serif text-[30px] font-normal leading-[1.1]">
        My <em className="text-forest">application.</em>
      </h1>
      <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
        Reference {app.refNo}
      </p>
      <Flash error={error} success={successMsg} />
      {paid && !voucherPaid && (
        <p className="mt-3 rounded-[11px] bg-line-soft p-3 text-sm text-ink">
          Thanks — we received your checkout and are confirming the payment with the provider. It usually
          reflects within a minute; refresh this page shortly. Please do not pay again.
        </p>
      )}
      {!editable && (
        <p className="mt-3 rounded-[11px] bg-line-soft p-3 text-sm text-ink">
          This application has been submitted and can no longer be edited here.
        </p>
      )}
      {editable && !anyProgrammeOpen && (
        <p className="mt-3 rounded-[11px] border border-gold/30 bg-[#f6efdf] p-3 text-sm text-[#7a5a22]">
          All programme intakes are currently closed. You can prepare your details now, but you&apos;ll be
          able to choose a programme and submit once the next intake opens.
        </p>
      )}

      <ApplicationWizard
        saveAction={saveApplicationDetails}
        app={{
          id: app.id,
          surname: app.surname,
          firstName: app.firstName,
          otherNames: app.otherNames,
          dateOfBirth: app.dateOfBirth ? app.dateOfBirth.toISOString().slice(0, 10) : null,
          gender: app.gender,
          nationality: app.nationality,
          phone: app.phone,
          address: app.address,
          emergencyName: app.emergencyName,
          emergencyPhone: app.emergencyPhone,
          qualificationType: app.qualificationType,
          examIndexNo: app.examIndexNo,
          examYear: app.examYear,
        }}
        schools={schools}
        choices={choices.map((c) => ({ rank: c.rank, programmeId: c.programmeId }))}
        results={results}
        editable={editable}
        initialStep={step ? (STEP_INDEX[step] ?? 0) : 0}
        resultsSlipForm={resultsSlipForm}
      />

      <div className="mt-4 text-sm text-muted">
        Need to upload certificates or a photo?{" "}
        <Link href="/apply/documents" className="text-forest hover:text-moss">Go to Documents →</Link>
      </div>

      {editable && (
        <form action={submitApplication} className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-5">
          <input type="hidden" name="applicationId" value={app.id} />
          <h2 className="font-semibold text-brand-900">Ready to submit?</h2>
          <p className="mt-1 text-sm text-brand-800">
            Make sure you have saved your details, uploaded your documents, and paid the application fee
            before submitting. Once submitted you cannot make further changes unless the admissions office
            requests more information.
          </p>
          <button
            type="submit"
            className="mt-3 rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep"
          >
            Submit application
          </button>
        </form>
      )}
    </div>
  );
}
