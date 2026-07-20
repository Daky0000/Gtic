"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo, shortCourseRefNo } from "@/lib/codes";
import { saveUpload, uploadRejection } from "@/lib/storage";
import { beginInvoicePayment } from "@/lib/payments";
import type { ShortCourseDocKind } from "@prisma/client";

/** Redirect back with a human-readable error instead of crashing the page. */
function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function isEditable(status: string) {
  return status === "DRAFT";
}

// Enum fields come in as free-form strings from the form — only ever accept
// a value that matches one of the options the wizard actually renders;
// anything else (a tampered request) is silently dropped to null rather
// than trusted.
const ACCOMMODATION_CHOICES = ["YES", "NO", "NOT_SURE"] as const;
const TSHIRT_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
const EDUCATION_LEVELS = ["WASSCE", "DIPLOMA", "HND", "DEGREE", "OTHER"] as const;
const EXPERIENCE_LEVELS = ["NONE", "MONTHS_0_6", "MONTHS_6_24", "YEARS_2_PLUS"] as const;
const SPONSORSHIP_TYPES = ["SELF", "COMPANY", "NGO"] as const;
const REFERRAL_SOURCES = ["FACEBOOK", "WHATSAPP", "FRIEND", "RADIO", "ECG", "OTHER"] as const;

function enumOrNull<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

async function getOwnRegistration(registrationId: string, userId: string) {
  return db.shortCourseRegistration.findFirstOrThrow({
    where: { id: registrationId, userId },
    include: { shortCourse: true },
  });
}

// ─── Applicant: start / edit a registration ───

/**
 * Registers interest in a course (creating a DRAFT registration the first
 * time) and sends the applicant to the multi-step intake form. Re-entering
 * an existing registration — draft, awaiting payment, or confirmed — just
 * returns to the same record; the wizard page itself decides what's
 * editable from its status.
 */
export async function startShortCourseRegistration(formData: FormData) {
  const user = await requireUser();
  const shortCourseId = String(formData.get("shortCourseId"));

  const course = await db.shortCourse.findUnique({ where: { id: shortCourseId } });
  if (!course || !course.active) fail("/short-courses", "That course is not open for registration.");

  const existing = await db.shortCourseRegistration.findUnique({
    where: { shortCourseId_userId: { shortCourseId: course.id, userId: user.id } },
  });
  const registration =
    existing ?? (await db.shortCourseRegistration.create({ data: { shortCourseId: course.id, userId: user.id } }));

  redirect(`/short-courses/register/${registration.id}`);
}

export async function saveShortCourseRegistrationDetails(formData: FormData) {
  const user = await requireUser();
  const registrationId = String(formData.get("registrationId"));
  const reg = await getOwnRegistration(registrationId, user.id);
  const back = `/short-courses/register/${reg.id}`;

  if (!isEditable(reg.status)) fail(back, "This registration can no longer be edited.");

  const str = (k: string) => {
    const v = formData.get(k);
    const s = v ? String(v).trim() : "";
    return s.length > 0 ? s : null;
  };

  const dobRaw = str("dateOfBirth");
  let dateOfBirth: Date | null = null;
  if (dobRaw) {
    const d = new Date(dobRaw);
    const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000);
    if (Number.isNaN(d.getTime()) || age < 18 || age > 100) {
      fail(back, "Check your date of birth — trainees must be 18 years or older.");
    }
    dateOfBirth = d;
  }
  const phone = str("phone");
  if (phone && !/^[+\d][\d\s-]{6,19}$/.test(phone)) {
    fail(back, "Check your phone number — digits only, e.g. 0241234567.");
  }
  const emergencyPhone = str("emergencyPhone");
  if (emergencyPhone && !/^[+\d][\d\s-]{6,19}$/.test(emergencyPhone)) {
    fail(back, "Check the emergency contact phone number — digits only.");
  }

  // Batch must belong to this course and still be open.
  const batchId = str("batchId");
  if (batchId) {
    const batch = await db.shortCourseBatch.findUnique({ where: { id: batchId } });
    if (!batch || batch.shortCourseId !== reg.shortCourseId || !batch.active) {
      fail(back, "Choose a valid batch for this course.");
    }
  }

  const fullDurationRaw = str("fullDuration");
  const fullDuration = fullDurationRaw === "yes" ? true : fullDurationRaw === "no" ? false : null;

  const tools = formData.getAll("tools").map(String).filter(Boolean);

  await db.shortCourseRegistration.update({
    where: { id: reg.id },
    data: {
      batchId,
      // Section A
      fullName: str("fullName"),
      gender: str("gender"),
      dateOfBirth,
      idNumber: str("idNumber"),
      phone,
      currentAddress: str("currentAddress"),
      homeRegion: str("homeRegion"),
      emergencyName: str("emergencyName"),
      emergencyRelationship: str("emergencyRelationship"),
      emergencyPhone,
      emergencyEmail: str("emergencyEmail"),
      // Section B
      fullDuration,
      partialDurationNote: fullDuration === false ? str("partialDurationNote") : null,
      accommodation: enumOrNull(str("accommodation"), ACCOMMODATION_CHOICES),
      tshirtSize: enumOrNull(str("tshirtSize"), TSHIRT_SIZES),
      // Section C
      educationLevel: enumOrNull(str("educationLevel"), EDUCATION_LEVELS),
      educationOther: str("educationOther"),
      experienceLevel: enumOrNull(str("experienceLevel"), EXPERIENCE_LEVELS),
      experienceNote: str("experienceNote"),
      toolsOwned: tools,
      // Section D
      medicalConditions: str("medicalConditions"),
      bloodGroup: str("bloodGroup"),
      // Section E
      referralSource: enumOrNull(str("referralSource"), REFERRAL_SOURCES),
      referralOther: str("referralOther"),
      sponsorship: enumOrNull(str("sponsorship"), SPONSORSHIP_TYPES),
      sponsorName: str("sponsorName"),
      declarationName: str("declarationName"),
      declarationAccepted: formData.get("declarationAccepted") === "on",
    },
  });

  redirect(`${back}?saved=1`);
}

// ─── Applicant: documents ───

const SHORT_COURSE_DOC_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"] as const;
const SHORT_COURSE_DOC_KINDS: ReadonlySet<string> = new Set([
  "CV", "CERTIFICATE", "PHOTO", "ID_DOCUMENT", "OTHER",
] satisfies ShortCourseDocKind[]);

export async function uploadShortCourseDocument(formData: FormData) {
  const user = await requireUser();
  const registrationId = String(formData.get("registrationId"));
  const reg = await getOwnRegistration(registrationId, user.id);
  const back = `/short-courses/register/${reg.id}`;
  if (!isEditable(reg.status)) fail(back, "Documents can no longer be changed after submission.");

  const kindRaw = String(formData.get("kind"));
  if (!SHORT_COURSE_DOC_KINDS.has(kindRaw)) fail(back, "Unknown document type.");
  const kind = kindRaw as ShortCourseDocKind;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) fail(back, "Choose a file to upload.");
  const rejection = uploadRejection(file, { allowedExtensions: SHORT_COURSE_DOC_EXTENSIONS });
  if (rejection) fail(back, rejection);

  const saved = await saveUpload(file, `short-course-registrations/${reg.id}`);
  await db.shortCourseDocument.create({ data: { registrationId: reg.id, kind, ...saved } });

  redirect(`${back}?uploaded=1`);
}

export async function deleteShortCourseDocument(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const doc = await db.shortCourseDocument.findFirstOrThrow({
    where: { id: documentId },
    include: { registration: true },
  });
  const back = `/short-courses/register/${doc.registrationId}`;
  if (doc.registration.userId !== user.id) fail(back, "Not your document.");
  if (!isEditable(doc.registration.status)) fail(back, "Documents can no longer be changed after submission.");

  await db.shortCourseDocument.delete({ where: { id: doc.id } });
  redirect(back);
}

// ─── Applicant: submit + pay ───

export async function submitShortCourseRegistration(formData: FormData) {
  const user = await requireUser();
  const registrationId = String(formData.get("registrationId"));
  const reg = await db.shortCourseRegistration.findFirstOrThrow({
    where: { id: registrationId, userId: user.id },
    include: { shortCourse: true, documents: true },
  });
  const back = `/short-courses/register/${reg.id}`;

  if (!isEditable(reg.status)) fail(back, "This registration has already been submitted.");
  if (!reg.shortCourse.active) fail(back, "This course is no longer open for registration.");
  if (reg.shortCourse.feePesewas <= 0) {
    fail(back, `The fee for "${reg.shortCourse.name}" has not been published yet — registration opens once it is.`);
  }
  if (!reg.fullName || !reg.gender || !reg.dateOfBirth || !reg.idNumber || !reg.phone) {
    fail(back, "Fill in and save your personal details first.");
  }
  if (!reg.currentAddress || !reg.homeRegion) fail(back, "Fill in where you're staying and your home region.");
  if (!reg.emergencyName || !reg.emergencyPhone) fail(back, "Add an emergency contact.");
  if (!reg.batchId) fail(back, "Choose a preferred batch.");
  if (!reg.tshirtSize) fail(back, "Choose a T-shirt size for your PPE.");
  if (!reg.educationLevel) fail(back, "Choose your highest education level.");
  if (reg.documents.length === 0) fail(back, "Upload at least one supporting document (CV, certificate or photo).");
  if (!reg.declarationAccepted || !reg.declarationName) {
    fail(back, "Read and accept the declaration, and type your name as your signature.");
  }

  const refNo = shortCourseRefNo(reg.shortCourse.code);

  let invoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "SHORT_COURSE", meta: { path: ["registrationId"], equals: reg.id } },
  });
  if (!invoice) {
    invoice = await db.invoice.create({
      data: {
        invoiceNo: invoiceNo("SHO"),
        kind: "SHORT_COURSE",
        userId: user.id,
        total: reg.shortCourse.feePesewas,
        meta: { registrationId: reg.id, shortCourseCode: reg.shortCourse.code },
        lines: {
          create: [{ description: `${reg.shortCourse.name} — ${reg.shortCourse.durationWeeks}-week intensive`, amount: reg.shortCourse.feePesewas }],
        },
      },
    });
  }

  await db.shortCourseRegistration.update({
    where: { id: reg.id },
    data: {
      status: "PENDING_PAYMENT",
      refNo,
      invoiceId: invoice.id,
      declarationSignedAt: new Date(),
    },
  });
  await audit({
    actorId: user.id, action: "short_course.submitted", entityType: "ShortCourseRegistration",
    entityId: reg.id, after: { refNo, invoiceNo: invoice.invoiceNo },
  });

  redirect(`${back}?submitted=1`);
}

export async function payShortCourseRegistrationFee(formData: FormData) {
  const user = await requireUser();
  const registrationId = String(formData.get("registrationId"));
  const reg = await getOwnRegistration(registrationId, user.id);
  const back = `/short-courses/register/${reg.id}`;
  if (reg.status !== "PENDING_PAYMENT" || !reg.invoiceId) fail(back, "Nothing to pay yet — submit your registration first.");

  const result = await beginInvoicePayment({
    invoiceId: reg.invoiceId,
    userEmail: user.email,
    returnTo: back,
  });
  if (result.kind === "failed") fail(back, result.message);
  if (result.kind === "settled") redirect(`${back}?paid=1`);
  redirect(result.url);
}
