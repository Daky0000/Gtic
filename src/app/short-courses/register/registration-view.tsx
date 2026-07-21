import Link from "next/link";
import { db } from "@/lib/db";
import {
  deleteShortCourseDocument, listSelectableShortCourses, payShortCourseRegistrationFee,
  recordManualShortCourseFeePayment, saveShortCourseRegistrationDetails, submitShortCourseRegistration,
  uploadShortCourseDocument,
} from "@/lib/actions/short-courses";
import { formatGHS } from "@/lib/money";
import { Flash } from "@/components/flash";
import { ShortCourseRegistrationWizard } from "./[id]/registration-wizard";
import type { Prisma } from "@prisma/client";

const STEP_INDEX: Record<string, number> = { "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 };

const DOC_KIND_LABEL: Record<string, string> = {
  CV: "CV / résumé",
  CERTIFICATE: "Certificate",
  PHOTO: "Passport photo",
  ID_DOCUMENT: "ID document",
  OTHER: "Other",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  MOMO: "MTN MoMo",
  VODAFONE_CASH: "Vodafone Cash",
  CASH: "cash",
  PAYSTACK: "Paystack",
};

export type RegistrationWithRelations = Prisma.ShortCourseRegistrationGetPayload<{
  include: {
    shortCourse: { include: { batches: true } };
    documents: true;
  };
}>;

/**
 * Renders a short-course registration end to end (status banners, the
 * intake wizard, submit panel, payment panel) — shared by /short-courses's
 * own per-course URL and /apply/application's stable URL. `returnTo` is
 * threaded into every form so submissions land back on whichever page
 * rendered this, instead of always bouncing to /short-courses/register/[id].
 */
export async function RegistrationView({
  reg,
  returnTo,
  searchParams,
}: {
  reg: RegistrationWithRelations;
  returnTo: string;
  searchParams: {
    error?: string; saved?: string; submitted?: string; paid?: string; uploaded?: string; step?: string;
    paymentSubmitted?: string;
  };
}) {
  const { error, saved, submitted, paid, uploaded, step, paymentSubmitted } = searchParams;

  const invoice = reg.invoiceId
    ? await db.invoice.findUnique({ where: { id: reg.invoiceId }, include: { payments: true } })
    : null;
  const pendingTellerPayment = invoice?.payments.find((p) => p.channel === "TELLER" && p.status === "PENDING") ?? null;

  const editable = reg.status === "DRAFT";
  const courses = await listSelectableShortCourses({ pinnedCourseId: reg.shortCourseId, pinnedBatchId: reg.batchId });

  const successMsg = saved
    ? "Your details were saved."
    : uploaded
      ? "Document uploaded."
      : submitted
        ? "Registration submitted for review — we'll notify you once a decision is made."
        : paid
          ? "Payment received — your registration is confirmed."
          : paymentSubmitted
            ? "Payment reference submitted — the Center will confirm it and your place will be secured shortly."
            : undefined;

  const documentsSection = (
    <div>
      {editable && (
        <form
          action={uploadShortCourseDocument}
          encType="multipart/form-data"
          className="flex flex-wrap items-end gap-3 rounded-[14px] border border-line-soft bg-cream p-4"
        >
          <input type="hidden" name="registrationId" value={reg.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div>
            <label className="block text-[13px] text-muted">Document type</label>
            <select name="kind" required className="mt-1.5 rounded-[11px] border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest">
              {Object.entries(DOC_KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[13px] text-muted">File (PDF, PNG, JPG or WEBP)</label>
            <input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp" className="mt-1.5 text-sm" />
          </div>
          <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
            Upload
          </button>
        </form>
      )}
      <div className="mt-3 space-y-2">
        {reg.documents.length === 0 && <p className="text-sm text-faint">No documents uploaded yet.</p>}
        {reg.documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-line-soft bg-cream px-4 py-2.5">
            <div className="text-sm">
              <span className="font-medium text-ink">{DOC_KIND_LABEL[doc.kind]}</span>{" "}
              <span className="text-faint">— {doc.fileName} · {(doc.size / 1024).toFixed(0)} KB</span>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/api/files/${doc.filePath}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-ink-300 px-3 py-1 text-xs font-medium text-ink-700 hover:bg-ink-100">
                View
              </a>
              {editable && (
                <form action={deleteShortCourseDocument}>
                  <input type="hidden" name="documentId" value={doc.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit" className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                    Delete
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="scr mx-auto max-w-3xl px-4 pb-16 pt-10">
      <Link href="/short-courses" className="text-sm text-forest hover:text-moss">← All short courses</Link>
      <h1 className="mt-2 font-serif text-[30px] font-normal leading-[1.1]">
        {reg.shortCourse.name} <em className="text-forest">registration.</em>
      </h1>
      <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
        {reg.refNo ? `Reference ${reg.refNo}` : `${reg.shortCourse.durationWeeks}-week intensive`}
      </p>
      <Flash error={error} success={successMsg} />

      {reg.status === "SUBMITTED" && (
        <p className="mt-3 rounded-[11px] bg-line-soft p-3 text-sm text-ink">
          Submitted{reg.submittedAt ? ` ${reg.submittedAt.toLocaleDateString()}` : ""} — awaiting the Center&apos;s
          review. You&apos;ll be notified once a decision is made.
        </p>
      )}
      {reg.status === "WAITLISTED" && (
        <p className="mt-3 rounded-[11px] border border-[#c9dde4] bg-[#deebf0] p-3 text-sm text-[#2e6f86]">
          You&apos;re on the waitlist for this course{reg.decisionNote ? `: ${reg.decisionNote}` : "."} We&apos;ll
          let you know if a place opens up.
        </p>
      )}
      {reg.status === "REJECTED" && (
        <p className="mt-3 rounded-[11px] border border-[#e3b5ad] bg-[#faece9] p-3 text-sm text-[#b23a2e]">
          Your application was not successful this time{reg.decisionNote ? `: ${reg.decisionNote}` : "."}
        </p>
      )}
      {reg.status === "PENDING_PAYMENT" && (
        <p className="mt-3 rounded-[11px] border border-brand-200 bg-[#eaf0ea] p-3 text-sm text-forest">
          ✓ Approved{reg.decisionNote ? `: ${reg.decisionNote}` : "."} Pay the course fee below to confirm your
          place.
        </p>
      )}
      {reg.status === "CONFIRMED" && (
        <p className="mt-3 rounded-[11px] border border-brand-200 bg-[#eaf0ea] p-3 text-sm text-forest">
          ✓ Registration confirmed. The Center will contact you with joining details.
        </p>
      )}
      {reg.status === "CANCELLED" && (
        <p className="mt-3 rounded-[11px] bg-line-soft p-3 text-sm text-ink">This registration was cancelled.</p>
      )}

      <ShortCourseRegistrationWizard
        saveAction={saveShortCourseRegistrationDetails}
        reg={{
          id: reg.id,
          shortCourseId: reg.shortCourseId,
          fullName: reg.fullName,
          gender: reg.gender,
          dateOfBirth: reg.dateOfBirth ? reg.dateOfBirth.toISOString().slice(0, 10) : null,
          idNumber: reg.idNumber,
          phone: reg.phone,
          email: reg.email,
          currentAddress: reg.currentAddress,
          homeRegion: reg.homeRegion,
          emergencyName: reg.emergencyName,
          emergencyRelationship: reg.emergencyRelationship,
          emergencyPhone: reg.emergencyPhone,
          emergencyEmail: reg.emergencyEmail,
          batchId: reg.batchId,
          fullDuration: reg.fullDuration,
          partialDurationNote: reg.partialDurationNote,
          accommodation: reg.accommodation,
          tshirtSize: reg.tshirtSize,
          educationLevel: reg.educationLevel,
          educationOther: reg.educationOther,
          experienceLevel: reg.experienceLevel,
          experienceNote: reg.experienceNote,
          toolsOwned: reg.toolsOwned,
          medicalConditions: reg.medicalConditions,
          bloodGroup: reg.bloodGroup,
          referralSource: reg.referralSource,
          referralOther: reg.referralOther,
          sponsorship: reg.sponsorship,
          sponsorName: reg.sponsorName,
          declarationName: reg.declarationName,
          declarationAccepted: reg.declarationAccepted,
        }}
        courses={courses}
        documentsSection={documentsSection}
        editable={editable}
        initialStep={step ? (STEP_INDEX[step] ?? 0) : 0}
        returnTo={returnTo}
      />

      {editable && (
        <form action={submitShortCourseRegistration} className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-5">
          <input type="hidden" name="registrationId" value={reg.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <h2 className="font-semibold text-brand-900">Ready to submit?</h2>
          <p className="mt-1 text-sm text-brand-800">
            Make sure you have saved your details, chosen a batch, uploaded a document, and accepted the
            declaration. Once submitted you cannot make further changes.
          </p>
          <button type="submit" className="mt-3 rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep">
            Submit registration
          </button>
        </form>
      )}

      {reg.status === "PENDING_PAYMENT" && invoice && (
        <div className="mt-6 rounded-lg border border-gold/30 bg-[#f6efdf] p-5">
          <h2 className="font-semibold text-[#7a5a22]">Pay the course fee</h2>
          <p className="mt-1 font-serif text-[26px] text-forest">{formatGHS(invoice.total - invoice.paid)}</p>
          <p className="mt-1 text-sm text-[#7a5a22]">Payment confirms your place on the course.</p>
          <form action={payShortCourseRegistrationFee} className="mt-3">
            <input type="hidden" name="registrationId" value={reg.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit" className="rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white hover:bg-forest-deep">
              Pay {formatGHS(invoice.total - invoice.paid)}
            </button>
          </form>

          {pendingTellerPayment ? (
            <p className="mt-4 rounded-[11px] border border-line-soft bg-cream p-3 text-sm text-ink">
              A {PAYMENT_METHOD_LABEL[(pendingTellerPayment.meta as { method?: string } | null)?.method ?? ""] ?? "manual"}{" "}
              payment (ref {(pendingTellerPayment.meta as { tellerRef?: string } | null)?.tellerRef ?? "—"}) is awaiting
              confirmation by the Center.
            </p>
          ) : (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-[#7a5a22]">
                Already paid via MTN MoMo, Vodafone Cash or cash at the office?
              </summary>
              <form action={recordManualShortCourseFeePayment} className="mt-3 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="registrationId" value={reg.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <div>
                  <label className="block text-[13px] text-muted">Payment method</label>
                  <select name="paymentMethod" required className="mt-1.5 w-full rounded-[11px] border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest">
                    <option value="MOMO">MTN MoMo</option>
                    <option value="VODAFONE_CASH">Vodafone Cash</option>
                    <option value="CASH">Cash at office</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] text-muted">MoMo transaction ID / receipt no.</label>
                  <input name="tellerRef" required className="mt-1.5 w-full rounded-[11px] border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest" />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="rounded-full border border-[#7a5a22] px-4 py-2.5 text-sm font-medium text-[#7a5a22] hover:bg-[#f0e6cf]">
                    Submit for confirmation
                  </button>
                </div>
              </form>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
