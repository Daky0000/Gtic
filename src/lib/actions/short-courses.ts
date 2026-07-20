"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo, paymentReference, shortCourseRefNo } from "@/lib/codes";
import { saveUpload, uploadRejection } from "@/lib/storage";
import { beginInvoicePayment, confirmPayment } from "@/lib/payments";
import { notify } from "@/lib/notify";
import type { ShortCourseDocKind } from "@prisma/client";

/** Redirect back with a human-readable error instead of crashing the page. */
function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function isEditable(status: string) {
  return status === "DRAFT";
}

/** Staff roles allowed to key in a walk-in's paper-form registration and review it. */
const STAFF_ROLES = [ROLES.ADMISSIONS_OFFICER, ROLES.REGISTRAR, ROLES.MANAGEMENT, ROLES.SYSTEM_ADMIN] as const;

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
/** Payment methods a paper form / manual reference can be recorded against —
 * "Payment Method" checkboxes on the paper form (Section E). Online card
 * payments still go through the real Paystack checkout (beginInvoicePayment);
 * these are for money that already changed hands off-platform. */
const OFFLINE_PAYMENT_METHODS = ["MOMO", "VODAFONE_CASH", "CASH", "PAYSTACK"] as const;

function enumOrNull<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

async function getOwnRegistration(registrationId: string, userId: string) {
  return db.shortCourseRegistration.findFirstOrThrow({
    where: { id: registrationId, userId },
    include: { shortCourse: true },
  });
}

/** Shared Section A–E field mapping for both the applicant's own wizard and
 * the staff paper-form intake — one source of truth for what a submitted
 * form actually contains. */
async function applyRegistrationFields(reg: { id: string; shortCourseId: string }, formData: FormData, back: string) {
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
      fail(back, "Check the date of birth — trainees must be 18 years or older.");
    }
    dateOfBirth = d;
  }
  const email = str("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(back, "Check the email address.");
  }
  const phone = str("phone");
  if (phone && !/^[+\d][\d\s-]{6,19}$/.test(phone)) {
    fail(back, "Check the phone number — digits only, e.g. 0241234567.");
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
      email,
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
}

/** Shared submit-readiness check (Section A–E required fields + the declaration). */
function checkRegistrationComplete(
  reg: {
    fullName: string | null; gender: string | null; dateOfBirth: Date | null; idNumber: string | null;
    phone: string | null; currentAddress: string | null; homeRegion: string | null; emergencyName: string | null;
    emergencyPhone: string | null; batchId: string | null; tshirtSize: string | null; educationLevel: string | null;
    declarationAccepted: boolean; declarationName: string | null;
  },
  back: string,
) {
  if (!reg.fullName || !reg.gender || !reg.dateOfBirth || !reg.idNumber || !reg.phone) {
    fail(back, "Fill in the personal details first — name, gender, date of birth, ID number and phone.");
  }
  if (!reg.currentAddress || !reg.homeRegion) fail(back, "Fill in where the applicant is staying and their home region.");
  if (!reg.emergencyName || !reg.emergencyPhone) fail(back, "Add an emergency contact.");
  if (!reg.batchId) fail(back, "Choose a preferred batch.");
  if (!reg.tshirtSize) fail(back, "Choose a T-shirt size for the PPE.");
  if (!reg.educationLevel) fail(back, "Choose the highest education level.");
  if (!reg.declarationAccepted || !reg.declarationName) {
    fail(back, "Read and accept the declaration, and record the applicant's name as their signature.");
  }
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
    existing ??
    (await db.shortCourseRegistration.create({
      data: { shortCourseId: course.id, userId: user.id, email: user.email },
    }));

  redirect(`/short-courses/register/${registration.id}`);
}

export async function saveShortCourseRegistrationDetails(formData: FormData) {
  const user = await requireUser();
  const registrationId = String(formData.get("registrationId"));
  const reg = await getOwnRegistration(registrationId, user.id);
  const back = `/short-courses/register/${reg.id}`;

  if (!isEditable(reg.status)) fail(back, "This registration can no longer be edited.");

  await applyRegistrationFields(reg, formData, back);
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

// ─── Applicant: submit for review + pay ───

/**
 * Submits the form for the office's review — the paper form's "FOR OFFICE
 * USE ONLY" strip (Admission Status: Approved/Waitlisted/Rejected) happens
 * next, not automatically. No invoice is raised here; approval is what
 * raises it (see staffApproveShortCourseRegistration).
 */
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
  checkRegistrationComplete(reg, back);
  if (reg.documents.length === 0) fail(back, "Upload at least one supporting document (CV, certificate or photo).");

  const refNo = shortCourseRefNo(reg.shortCourse.code);

  await db.shortCourseRegistration.update({
    where: { id: reg.id },
    data: {
      status: "SUBMITTED",
      refNo,
      submittedAt: new Date(),
      declarationSignedAt: new Date(),
    },
  });
  await audit({
    actorId: user.id, action: "short_course.submitted", entityType: "ShortCourseRegistration",
    entityId: reg.id, after: { refNo },
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

/**
 * Applicant self-reports a MoMo/Vodafone Cash/cash payment made directly to
 * the Center (Section E's "Payment Method" options besides Paystack). Lands
 * as a PENDING teller-style payment for staff to verify on /staff/finance —
 * the same confirm/reject flow used for bank-teller tuition payments — so a
 * self-reported reference is never trusted as paid until staff checks it.
 */
export async function recordManualShortCourseFeePayment(formData: FormData) {
  const user = await requireUser();
  const registrationId = String(formData.get("registrationId"));
  const reg = await getOwnRegistration(registrationId, user.id);
  const back = `/short-courses/register/${reg.id}`;
  if (reg.status !== "PENDING_PAYMENT" || !reg.invoiceId) {
    fail(back, "Nothing to pay yet — submit your registration first.");
  }

  const method = enumOrNull(String(formData.get("paymentMethod") ?? ""), OFFLINE_PAYMENT_METHODS);
  if (!method) fail(back, "Choose how the payment was made.");
  const tellerRef = String(formData.get("tellerRef") ?? "").trim();
  if (!tellerRef) fail(back, "Enter the MoMo transaction ID or receipt number.");

  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: reg.invoiceId } });
  const balance = invoice.total - invoice.paid;
  if (balance <= 0) redirect(`${back}?paid=1`);

  const existing = await db.payment.findFirst({
    where: { invoiceId: invoice.id, channel: "TELLER", status: "PENDING" },
  });
  if (existing) fail(back, "A payment is already awaiting confirmation — contact the Center if this takes more than a day.");

  await db.payment.create({
    data: {
      invoiceId: invoice.id, channel: "TELLER", reference: paymentReference(),
      amount: balance, status: "PENDING", meta: { method, tellerRef },
    },
  });
  redirect(`${back}?paymentSubmitted=1`);
}

/** Raises (or reuses) the SHORT_COURSE invoice an approved registration is billed against. */
async function getOrCreateShortCourseInvoice(reg: {
  id: string; userId: string; invoiceId: string | null;
  shortCourse: { name: string; code: string; feePesewas: number; durationWeeks: number };
}) {
  if (reg.invoiceId) {
    const existing = await db.invoice.findUnique({ where: { id: reg.invoiceId } });
    if (existing) return existing;
  }
  return db.invoice.create({
    data: {
      invoiceNo: invoiceNo("SHO"),
      kind: "SHORT_COURSE",
      userId: reg.userId,
      total: reg.shortCourse.feePesewas,
      meta: { registrationId: reg.id, shortCourseCode: reg.shortCourse.code },
      lines: {
        create: [{ description: `${reg.shortCourse.name} — ${reg.shortCourse.durationWeeks}-week intensive`, amount: reg.shortCourse.feePesewas }],
      },
    },
  });
}

// ─── Staff: review a submitted registration (the paper form's "Admission Status") ───

export async function staffApproveShortCourseRegistration(formData: FormData) {
  const staff = await requireRole(...STAFF_ROLES);
  const registrationId = String(formData.get("registrationId"));
  const reg = await db.shortCourseRegistration.findFirstOrThrow({
    where: { id: registrationId },
    include: { shortCourse: true },
  });
  const back = `/staff/short-courses/${reg.id}`;

  if (reg.status !== "SUBMITTED" && reg.status !== "WAITLISTED") {
    fail(back, "Only submitted or waitlisted registrations can be approved.");
  }
  if (!reg.shortCourse.active) fail(back, "This course is no longer open for registration.");
  if (reg.shortCourse.feePesewas <= 0) fail(back, `The fee for "${reg.shortCourse.name}" has not been published yet.`);

  const note = String(formData.get("note") ?? "").trim() || null;
  const invoice = await getOrCreateShortCourseInvoice(reg);

  await db.shortCourseRegistration.update({
    where: { id: reg.id },
    data: { status: "PENDING_PAYMENT", invoiceId: invoice.id, decidedAt: new Date(), decisionNote: note },
  });
  await audit({
    actorId: staff.id, action: "short_course.approved", entityType: "ShortCourseRegistration",
    entityId: reg.id, after: { note },
  });
  await notify(
    reg.userId,
    "Application approved",
    `Your application for "${reg.shortCourse.name}" has been approved. Pay the course fee to confirm your place.`,
    `/short-courses/register/${reg.id}`,
  );
  redirect(`${back}?decided=1`);
}

export async function staffWaitlistShortCourseRegistration(formData: FormData) {
  const staff = await requireRole(...STAFF_ROLES);
  const registrationId = String(formData.get("registrationId"));
  const reg = await db.shortCourseRegistration.findFirstOrThrow({
    where: { id: registrationId },
    include: { shortCourse: true },
  });
  const back = `/staff/short-courses/${reg.id}`;
  if (reg.status !== "SUBMITTED") fail(back, "Only submitted registrations can be waitlisted.");

  const note = String(formData.get("note") ?? "").trim() || null;
  await db.shortCourseRegistration.update({
    where: { id: reg.id },
    data: { status: "WAITLISTED", decidedAt: new Date(), decisionNote: note },
  });
  await audit({
    actorId: staff.id, action: "short_course.waitlisted", entityType: "ShortCourseRegistration",
    entityId: reg.id, after: { note },
  });
  await notify(
    reg.userId,
    "You're on the waitlist",
    `You've been placed on the waitlist for "${reg.shortCourse.name}"${note ? `: ${note}` : "."} We'll let you know if a place opens up.`,
    `/short-courses/register/${reg.id}`,
  );
  redirect(`${back}?decided=1`);
}

export async function staffRejectShortCourseRegistration(formData: FormData) {
  const staff = await requireRole(...STAFF_ROLES);
  const registrationId = String(formData.get("registrationId"));
  const reg = await db.shortCourseRegistration.findFirstOrThrow({
    where: { id: registrationId },
    include: { shortCourse: true },
  });
  const back = `/staff/short-courses/${reg.id}`;
  if (reg.status !== "SUBMITTED" && reg.status !== "WAITLISTED") {
    fail(back, "Only submitted or waitlisted registrations can be rejected.");
  }

  const note = String(formData.get("note") ?? "").trim();
  if (!note) fail(back, "Give a reason the applicant will see.");

  await db.shortCourseRegistration.update({
    where: { id: reg.id },
    data: { status: "REJECTED", decidedAt: new Date(), decisionNote: note },
  });
  await audit({
    actorId: staff.id, action: "short_course.rejected", entityType: "ShortCourseRegistration",
    entityId: reg.id, after: { note },
  });
  await notify(
    reg.userId,
    "Application decision",
    `Your application for "${reg.shortCourse.name}" was not successful this time: ${note}`,
    `/short-courses/register/${reg.id}`,
  );
  redirect(`${back}?decided=1`);
}

// ─── Staff: register a walk-in applicant (paper-form intake) ───

/**
 * Starts (or resumes) a registration on behalf of a walk-in who filled the
 * physical paper form at the Center. Finds or creates the applicant's
 * account by email so the record has somewhere to live; the account holder
 * can later sign in (via password reset) to see their own registration.
 */
export async function staffStartShortCourseRegistration(formData: FormData) {
  const staff = await requireRole(...STAFF_ROLES);
  const back = "/staff/short-courses/new";

  const shortCourseId = String(formData.get("shortCourseId"));
  const course = await db.shortCourse.findUnique({ where: { id: shortCourseId } });
  if (!course || !course.active) fail(back, "That course is not open for registration.");

  const name = String(formData.get("applicantName") ?? "").trim();
  const email = String(formData.get("applicantEmail") ?? "").trim().toLowerCase();
  const phone = String(formData.get("applicantPhone") ?? "").trim();
  if (!name) fail(back, "Enter the applicant's full name.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(back, "Enter a valid email address for the applicant.");

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { name, email, emailVerified: false } });
  }

  const existing = await db.shortCourseRegistration.findUnique({
    where: { shortCourseId_userId: { shortCourseId: course.id, userId: user.id } },
  });
  const registration =
    existing ??
    (await db.shortCourseRegistration.create({
      data: {
        shortCourseId: course.id,
        userId: user.id,
        fullName: name,
        email,
        phone: phone || null,
      },
    }));

  await audit({
    actorId: staff.id, action: "short_course.staff_started", entityType: "ShortCourseRegistration",
    entityId: registration.id, after: { applicantEmail: email, courseCode: course.code },
  });

  redirect(`/staff/short-courses/${registration.id}/edit`);
}

async function getRegistrationForStaff(registrationId: string) {
  return db.shortCourseRegistration.findFirstOrThrow({
    where: { id: registrationId },
    include: { shortCourse: true },
  });
}

export async function staffSaveShortCourseRegistrationDetails(formData: FormData) {
  await requireRole(...STAFF_ROLES);
  const registrationId = String(formData.get("registrationId"));
  const reg = await getRegistrationForStaff(registrationId);
  const back = `/staff/short-courses/${reg.id}/edit`;

  if (reg.status === "CONFIRMED" || reg.status === "CANCELLED") fail(back, "This registration is closed and can no longer be edited.");

  await applyRegistrationFields(reg, formData, back);
  redirect(`${back}?saved=1`);
}

export async function staffUploadShortCourseDocument(formData: FormData) {
  await requireRole(...STAFF_ROLES);
  const registrationId = String(formData.get("registrationId"));
  const reg = await getRegistrationForStaff(registrationId);
  const back = `/staff/short-courses/${reg.id}/edit`;
  if (reg.status === "CONFIRMED" || reg.status === "CANCELLED") fail(back, "This registration is closed.");

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

export async function staffDeleteShortCourseDocument(formData: FormData) {
  await requireRole(...STAFF_ROLES);
  const documentId = String(formData.get("documentId"));
  const doc = await db.shortCourseDocument.findFirstOrThrow({
    where: { id: documentId },
    include: { registration: true },
  });
  const back = `/staff/short-courses/${doc.registrationId}/edit`;
  if (doc.registration.status === "CONFIRMED" || doc.registration.status === "CANCELLED") {
    fail(back, "This registration is closed.");
  }

  await db.shortCourseDocument.delete({ where: { id: doc.id } });
  redirect(back);
}

/**
 * Submits the walk-in's form and records the payment the Center already
 * collected in person — the digital equivalent of the paper form's "FOR
 * OFFICE USE ONLY" strip (received by, payment confirmed). Unlike the
 * applicant's own self-reported payment, staff are asserting they personally
 * took the money, so this confirms it immediately instead of queuing it for
 * review.
 */
export async function staffSubmitAndRecordPayment(formData: FormData) {
  const staff = await requireRole(...STAFF_ROLES);
  const registrationId = String(formData.get("registrationId"));
  const reg = await db.shortCourseRegistration.findFirstOrThrow({
    where: { id: registrationId },
    include: { shortCourse: true },
  });
  const back = `/staff/short-courses/${reg.id}/edit`;

  if (reg.status === "CONFIRMED") fail(back, "This registration is already confirmed.");
  if (reg.status === "CANCELLED") fail(back, "This registration was cancelled.");
  if (!reg.shortCourse.active) fail(back, "This course is no longer open for registration.");
  if (reg.shortCourse.feePesewas <= 0) {
    fail(back, `The fee for "${reg.shortCourse.name}" has not been published yet.`);
  }
  checkRegistrationComplete(reg, back);

  const method = enumOrNull(String(formData.get("paymentMethod") ?? ""), OFFLINE_PAYMENT_METHODS);
  if (!method) fail(back, "Choose how the applicant paid.");
  const tellerRef = String(formData.get("tellerRef") ?? "").trim();
  const amountGHS = Number(formData.get("amountPaid"));
  const amount = Number.isFinite(amountGHS) && amountGHS > 0 ? Math.round(amountGHS * 100) : reg.shortCourse.feePesewas;

  const refNo = reg.refNo ?? shortCourseRefNo(reg.shortCourse.code);
  const invoice = await getOrCreateShortCourseInvoice(reg);

  await db.shortCourseRegistration.update({
    where: { id: reg.id },
    data: {
      status: "PENDING_PAYMENT",
      refNo,
      invoiceId: invoice.id,
      submittedAt: reg.submittedAt ?? new Date(),
      decidedAt: new Date(),
      decisionNote: `Registered and approved by staff (${staff.name}).`,
      declarationSignedAt: reg.declarationSignedAt ?? new Date(),
    },
  });

  const payment = await db.payment.create({
    data: {
      invoiceId: invoice.id, channel: "TELLER", reference: paymentReference(),
      amount, status: "PENDING",
      meta: { method, tellerRef: tellerRef || undefined, recordedByStaffId: staff.id, walkIn: true },
    },
  });
  await confirmPayment(payment.id, staff.id);

  await audit({
    actorId: staff.id, action: "short_course.staff_registered_and_paid", entityType: "ShortCourseRegistration",
    entityId: reg.id, after: { refNo, method, amount },
  });

  redirect(`/staff/short-courses/${reg.id}?registered=1`);
}
