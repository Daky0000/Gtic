import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  staffDeleteShortCourseDocument, staffSaveShortCourseRegistrationDetails,
  staffSubmitAndRecordPayment, staffUploadShortCourseDocument,
} from "@/lib/actions/short-courses";
import { formatGHS } from "@/lib/money";
import { Flash } from "@/components/flash";
import { ShortCourseRegistrationWizard, type BatchOption } from "@/app/short-courses/register/[id]/registration-wizard";

export const metadata = { title: "Walk-in Registration" };

const STEP_INDEX: Record<string, number> = { "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 };

const DOC_KIND_LABEL: Record<string, string> = {
  CV: "CV / résumé",
  CERTIFICATE: "Certificate",
  PHOTO: "Passport photo",
  ID_DOCUMENT: "ID document",
  OTHER: "Other",
};

export default async function StaffEditShortCourseRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; uploaded?: string; step?: string }>;
}) {
  await requireRole(ROLES.ADMISSIONS_OFFICER, ROLES.REGISTRAR, ROLES.MANAGEMENT, ROLES.SYSTEM_ADMIN);
  const { id } = await params;
  const { error, saved, uploaded, step } = await searchParams;

  const reg = await db.shortCourseRegistration.findUnique({
    where: { id },
    include: {
      shortCourse: { include: { batches: { orderBy: { startDate: "asc" } } } },
      documents: { orderBy: { uploadedAt: "desc" } },
      user: true,
    },
  });
  if (!reg) notFound();

  const editable = reg.status !== "CONFIRMED" && reg.status !== "CANCELLED";
  const now = new Date();
  const batches: BatchOption[] = reg.shortCourse.batches
    .filter((b) => b.active && (b.startDate > now || b.id === reg.batchId))
    .map((b) => ({
      id: b.id,
      label: b.label,
      startDate: b.startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      endDate: b.endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    }));

  const successMsg = saved ? "Details saved." : uploaded ? "Document uploaded." : undefined;

  const documentsSection = (
    <div>
      {editable && (
        <form
          action={staffUploadShortCourseDocument}
          encType="multipart/form-data"
          className="flex flex-wrap items-end gap-3 rounded-[14px] border border-line-soft bg-cream p-4"
        >
          <input type="hidden" name="registrationId" value={reg.id} />
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
                <form action={staffDeleteShortCourseDocument}>
                  <input type="hidden" name="documentId" value={doc.id} />
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
    <div className="mx-auto max-w-3xl">
      <Link href="/staff/short-courses" className="text-sm text-ink-500 hover:underline">← Back to registrations</Link>
      <h1 className="mt-2 font-serif text-[30px] font-normal leading-[1.1] text-ink">
        {reg.shortCourse.name} <em className="text-forest">— walk-in intake.</em>
      </h1>
      <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
        {reg.refNo ? `Reference ${reg.refNo}` : `Account: ${reg.user.email}`}
      </p>
      <Flash error={error} success={successMsg} />

      {reg.status === "CONFIRMED" && (
        <p className="mt-3 rounded-[11px] border border-brand-200 bg-[#eaf0ea] p-3 text-sm text-forest">
          ✓ Registration confirmed and paid. This form is now closed.
        </p>
      )}
      {reg.status === "CANCELLED" && (
        <p className="mt-3 rounded-[11px] bg-line-soft p-3 text-sm text-ink">This registration was cancelled.</p>
      )}

      <ShortCourseRegistrationWizard
        saveAction={staffSaveShortCourseRegistrationDetails}
        reg={{
          id: reg.id,
          fullName: reg.fullName,
          gender: reg.gender,
          dateOfBirth: reg.dateOfBirth ? reg.dateOfBirth.toISOString().slice(0, 10) : null,
          idNumber: reg.idNumber,
          phone: reg.phone,
          email: reg.email ?? reg.user.email,
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
        batches={batches}
        documentsSection={documentsSection}
        editable={editable}
        initialStep={step ? (STEP_INDEX[step] ?? 0) : 0}
      />

      {editable && (
        <form action={staffSubmitAndRecordPayment} className="mt-6 rounded-lg border border-gold/30 bg-[#f6efdf] p-5">
          <input type="hidden" name="registrationId" value={reg.id} />
          <h2 className="font-semibold text-[#7a5a22]">FOR OFFICE USE — record payment &amp; confirm</h2>
          <p className="mt-1 text-sm text-[#7a5a22]">
            Course fee: {reg.shortCourse.feePesewas > 0 ? formatGHS(reg.shortCourse.feePesewas) : "not yet published"}.
            Recording a payment here submits the form and confirms the applicant&apos;s place immediately.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[13px] text-muted">Payment method</label>
              <select name="paymentMethod" required className="mt-1.5 w-full rounded-[11px] border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest">
                <option value="MOMO">MTN MoMo</option>
                <option value="VODAFONE_CASH">Vodafone Cash</option>
                <option value="CASH">Cash at office</option>
                <option value="PAYSTACK">Paystack (paid online)</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-muted">Transaction ID / receipt no.</label>
              <input name="tellerRef" className="mt-1.5 w-full rounded-[11px] border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest" />
            </div>
            <div>
              <label className="block text-[13px] text-muted">Amount paid (GH₵)</label>
              <input
                type="number"
                name="amountPaid"
                step="0.01"
                min="0"
                defaultValue={reg.shortCourse.feePesewas > 0 ? (reg.shortCourse.feePesewas / 100).toFixed(2) : undefined}
                className="mt-1.5 w-full rounded-[11px] border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest"
              />
            </div>
          </div>
          <button type="submit" className="mt-4 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white hover:bg-forest-deep">
            Submit registration &amp; confirm payment
          </button>
        </form>
      )}
    </div>
  );
}
