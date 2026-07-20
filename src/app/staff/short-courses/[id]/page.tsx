import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { ButtonLink, StatusChip, type ChipTone } from "@/components/ui";
import { Flash } from "@/components/flash";

export const metadata = { title: "Registration Details" };

const STATUS_TONE: Record<string, ChipTone> = {
  CONFIRMED: "green",
  PENDING_PAYMENT: "amber",
  DRAFT: "neutral",
  CANCELLED: "neutral",
};

const DOC_KIND_LABEL: Record<string, string> = {
  CV: "CV / résumé",
  CERTIFICATE: "Certificate",
  PHOTO: "Passport photo",
  ID_DOCUMENT: "ID document",
  OTHER: "Other",
};

const TOOL_LABEL: Record<string, string> = {
  MULTIMETER: "Multimeter",
  SCREWDRIVER_SET: "Screwdriver set",
  NONE: "None",
};

const EDUCATION_LABEL: Record<string, string> = {
  WASSCE: "WASSCE", DIPLOMA: "Diploma", HND: "HND", DEGREE: "Degree", OTHER: "Other",
};
const EXPERIENCE_LABEL: Record<string, string> = {
  NONE: "None", MONTHS_0_6: "0–6 months", MONTHS_6_24: "6 months – 2 years", YEARS_2_PLUS: "2+ years",
};
const ACCOMMODATION_LABEL: Record<string, string> = {
  YES: "Needs hostel", NO: "Has own accommodation", NOT_SURE: "Not sure",
};
const SPONSORSHIP_LABEL: Record<string, string> = {
  SELF: "Self-funded", COMPANY: "Company", NGO: "NGO / Scholarship",
};
const REFERRAL_LABEL: Record<string, string> = {
  FACEBOOK: "Facebook", WHATSAPP: "WhatsApp", FRIEND: "Friend", RADIO: "Radio", ECG: "ECG", OTHER: "Other",
};
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  MOMO: "MTN MoMo", VODAFONE_CASH: "Vodafone Cash", CASH: "cash", PAYSTACK: "Paystack",
};

export default async function StaffShortCourseRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ registered?: string }>;
}) {
  await requireRole(ROLES.ADMISSIONS_OFFICER, ROLES.REGISTRAR, ROLES.MANAGEMENT, ROLES.SYSTEM_ADMIN);
  const { id } = await params;
  const { registered } = await searchParams;

  const reg = await db.shortCourseRegistration.findUnique({
    where: { id },
    include: {
      shortCourse: true,
      batch: true,
      user: true,
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!reg) notFound();

  const invoice = reg.invoiceId
    ? await db.invoice.findUnique({ where: { id: reg.invoiceId }, include: { payments: true } })
    : null;
  const lastPayment = invoice?.payments.at(-1) ?? null;
  const paymentMethod = (lastPayment?.meta as { method?: string } | null)?.method;
  const editable = reg.status === "DRAFT" || reg.status === "PENDING_PAYMENT";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/staff/short-courses" className="text-sm text-ink-500 hover:underline">← Back to registrations</Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{reg.fullName || reg.user.name}</h1>
          <p className="font-mono text-sm text-ink-500">
            {reg.refNo ?? "no reference yet"} · {reg.email ?? reg.user.email} · {reg.shortCourse.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip tone={STATUS_TONE[reg.status] ?? "neutral"}>{reg.status.replace("_", " ")}</StatusChip>
          {editable && <ButtonLink href={`/staff/short-courses/${reg.id}/edit`} variant="outline">Edit</ButtonLink>}
        </div>
      </div>
      {registered && (
        <div className="mt-3">
          <Flash
            success={
              reg.status === "CONFIRMED"
                ? "Registration submitted and payment confirmed — the applicant's place is secured."
                : "Registration submitted and payment recorded — the balance still owing keeps this pending until it's paid in full."
            }
          />
        </div>
      )}

      <div className="mt-6 space-y-6">
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Personal details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-ink-500">Gender</dt><dd>{reg.gender ?? "—"}</dd></div>
            <div><dt className="text-ink-500">Date of birth</dt><dd>{reg.dateOfBirth?.toLocaleDateString() ?? "—"}</dd></div>
            <div><dt className="text-ink-500">Ghana Card / Passport</dt><dd>{reg.idNumber ?? "—"}</dd></div>
            <div><dt className="text-ink-500">Phone</dt><dd>{reg.phone ?? "—"}</dd></div>
            <div><dt className="text-ink-500">Email</dt><dd>{reg.email ?? reg.user.email}</dd></div>
            <div><dt className="text-ink-500">Currently staying at</dt><dd>{reg.currentAddress ?? "—"}</dd></div>
            <div><dt className="text-ink-500">Home region</dt><dd>{reg.homeRegion ?? "—"}</dd></div>
            <div className="col-span-2">
              <dt className="text-ink-500">Emergency contact</dt>
              <dd>
                {reg.emergencyName
                  ? `${reg.emergencyName}${reg.emergencyRelationship ? ` (${reg.emergencyRelationship})` : ""} — ${reg.emergencyPhone ?? "no phone"}${reg.emergencyEmail ? ` · ${reg.emergencyEmail}` : ""}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Training details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-ink-500">Batch</dt><dd>{reg.batch ? `${reg.batch.label} (${reg.batch.startDate.toLocaleDateString()} – ${reg.batch.endDate.toLocaleDateString()})` : "—"}</dd></div>
            <div><dt className="text-ink-500">Full duration?</dt><dd>{reg.fullDuration === null ? "—" : reg.fullDuration ? "Yes" : `No — ${reg.partialDurationNote ?? "no note"}`}</dd></div>
            <div><dt className="text-ink-500">Accommodation</dt><dd>{reg.accommodation ? ACCOMMODATION_LABEL[reg.accommodation] : "—"}</dd></div>
            <div><dt className="text-ink-500">T-shirt size</dt><dd>{reg.tshirtSize ?? "—"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Education &amp; experience</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-ink-500">Education level</dt><dd>{reg.educationLevel ? EDUCATION_LABEL[reg.educationLevel] : "—"}{reg.educationOther ? ` — ${reg.educationOther}` : ""}</dd></div>
            <div><dt className="text-ink-500">Prior experience</dt><dd>{reg.experienceLevel ? EXPERIENCE_LABEL[reg.experienceLevel] : "—"}{reg.experienceNote ? ` — ${reg.experienceNote}` : ""}</dd></div>
            <div className="col-span-2"><dt className="text-ink-500">Tools owned</dt><dd>{reg.toolsOwned.length > 0 ? reg.toolsOwned.map((t) => TOOL_LABEL[t] ?? t).join(", ") : "—"}</dd></div>
          </dl>

          <h3 className="mt-4 text-sm font-semibold text-ink-700">Documents</h3>
          {reg.documents.length === 0 ? (
            <p className="text-sm text-ink-500">No documents uploaded.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {reg.documents.map((doc) => (
                <li key={doc.id}>
                  <a href={`/api/files/${doc.filePath}`} target="_blank" rel="noopener noreferrer" className="text-forest hover:text-moss">
                    {DOC_KIND_LABEL[doc.kind]} — {doc.fileName}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Medical &amp; safety</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-ink-500">Medical conditions</dt><dd>{reg.medicalConditions ?? "None declared"}</dd></div>
            <div><dt className="text-ink-500">Blood group</dt><dd>{reg.bloodGroup ?? "—"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Referral, sponsorship &amp; payment</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-ink-500">Heard about us via</dt><dd>{reg.referralSource ? REFERRAL_LABEL[reg.referralSource] : "—"}{reg.referralOther ? ` — ${reg.referralOther}` : ""}</dd></div>
            <div><dt className="text-ink-500">Sponsorship</dt><dd>{reg.sponsorship ? SPONSORSHIP_LABEL[reg.sponsorship] : "—"}{reg.sponsorName ? ` — ${reg.sponsorName}` : ""}</dd></div>
            <div><dt className="text-ink-500">Declaration</dt><dd>{reg.declarationAccepted ? `Accepted — ${reg.declarationName ?? ""} (${reg.declarationSignedAt?.toLocaleString() ?? "—"})` : "Not accepted"}</dd></div>
            <div>
              <dt className="text-ink-500">Course fee</dt>
              <dd>
                {invoice ? `${formatGHS(invoice.paid)} / ${formatGHS(invoice.total)} paid` : "No invoice yet"}
                {paymentMethod && ` — via ${PAYMENT_METHOD_LABEL[paymentMethod] ?? paymentMethod}`}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
