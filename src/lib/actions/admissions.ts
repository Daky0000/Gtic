"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { applicationRefNo, verificationCode } from "@/lib/codes";
import { saveUpload } from "@/lib/storage";
import { beginInvoicePayment } from "@/lib/payments";
import { notify } from "@/lib/notify";
import { extractApplicationDocument, prescreenApplication } from "@/lib/ai/tasks";
import type { ApplicationDocKind, Recommendation } from "@prisma/client";

/** Redirect back with a human-readable error instead of crashing the page. */
function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

const EDITABLE_STATUSES = ["DRAFT", "INFO_REQUESTED"] as const;

function isEditable(status: string) {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

// ─── Shared lookups ───

async function currentOpenCycle() {
  return db.admissionCycle.findFirst({ where: { status: "OPEN" }, orderBy: { opensAt: "desc" } });
}

async function getOwnApplication(applicationId: string, userId: string) {
  return db.application.findFirstOrThrow({ where: { id: applicationId, userId } });
}

// ─── Applicant: start / edit the application ───

export async function getOrCreateDraftApplication(userId: string) {
  const cycle = await currentOpenCycle();

  const existing = await db.application.findFirst({
    where: { userId, ...(cycle ? { cycleId: cycle.id } : {}) },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  if (!cycle) return null;

  return db.application.create({
    data: {
      cycleId: cycle.id,
      userId,
      refNo: applicationRefNo(cycle.name.slice(0, 9)),
      status: "DRAFT",
    },
  });
}

export async function saveApplicationDetails(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);

  if (!isEditable(app.status)) {
    fail("/apply/application", "This application can no longer be edited.");
  }

  const str = (k: string) => {
    const v = formData.get(k);
    const s = v ? String(v).trim() : "";
    return s.length > 0 ? s : null;
  };
  const dob = str("dateOfBirth");
  if (dob) {
    const d = new Date(dob);
    const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000);
    if (Number.isNaN(d.getTime()) || age < 10 || age > 100) {
      fail("/apply/application", "Check your date of birth — it doesn't look right.");
    }
  }
  const phone = str("phone");
  if (phone && !/^[+\d][\d\s-]{6,19}$/.test(phone)) {
    fail("/apply/application", "Check your phone number — digits only, e.g. 0241234567.");
  }

  const results: { subject: string; grade: string }[] = [];
  for (let i = 0; i < 9; i++) {
    const subject = str(`subject_${i}`);
    const grade = str(`grade_${i}`);
    if (subject && grade) results.push({ subject, grade });
  }

  // De-duplicate programme choices while preserving rank order.
  const choiceIds = [...new Set([str("choice1"), str("choice2"), str("choice3")].filter(Boolean))] as string[];

  await db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: {
        surname: str("surname"),
        firstName: str("firstName"),
        otherNames: str("otherNames"),
        dateOfBirth: dob ? new Date(dob) : null,
        gender: str("gender"),
        nationality: str("nationality"),
        phone,
        address: str("address"),
        emergencyName: str("emergencyName"),
        emergencyPhone: str("emergencyPhone"),
        qualificationType: str("qualificationType"),
        examIndexNo: str("examIndexNo"),
        examYear: str("examYear"),
        results: results.length > 0 ? results : undefined,
      },
    });
    await tx.applicationChoice.deleteMany({ where: { applicationId: app.id } });
    for (let i = 0; i < choiceIds.length; i++) {
      await tx.applicationChoice.create({
        data: { applicationId: app.id, programmeId: choiceIds[i], rank: i + 1 },
      });
    }
  });

  redirect("/apply/application?saved=1");
}

// ─── Applicant: documents + AI extraction ───

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export async function uploadApplicationDocument(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  if (!isEditable(app.status)) {
    fail("/apply/documents", "Documents can no longer be changed after submission.");
  }

  const kind = String(formData.get("kind")) as ApplicationDocKind;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) fail("/apply/documents", "Choose a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) fail("/apply/documents", "File is too large — maximum 10 MB.");
  if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    fail("/apply/documents", "Only PDF, JPG, PNG or WEBP files are accepted.");
  }

  const saved = await saveUpload(file, `applications/${app.id}`);
  await db.applicationDocument.create({
    data: { applicationId: app.id, kind, ...saved },
  });

  redirect("/apply/documents");
}

export async function deleteApplicationDocument(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const doc = await db.applicationDocument.findFirstOrThrow({
    where: { id: documentId },
    include: { application: true },
  });
  if (doc.application.userId !== user.id) fail("/apply/documents", "Not your document.");
  if (!isEditable(doc.application.status)) {
    fail("/apply/documents", "Documents can no longer be changed after submission.");
  }

  await db.applicationDocument.delete({ where: { id: doc.id } });
  redirect("/apply/documents");
}

export async function runDocumentExtractionAction(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const doc = await db.applicationDocument.findFirstOrThrow({
    where: { id: documentId },
    include: { application: true },
  });
  const isStaff = user.roles.some((r) => r !== "applicant" && r !== "student" && r !== "alumni");
  const backPath = isStaff ? `/staff/admissions/${doc.applicationId}` : "/apply/documents";
  if (doc.application.userId !== user.id && !isStaff) fail(backPath, "Not your document.");

  const { result } = await extractApplicationDocument({
    userId: user.id,
    filePath: doc.filePath,
    mimeType: doc.mimeType,
  });
  await db.applicationDocument.update({
    where: { id: doc.id },
    data: { extracted: JSON.parse(JSON.stringify(result)) },
  });

  redirect(backPath);
}

export async function applyExtractedResults(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const doc = await db.applicationDocument.findFirstOrThrow({
    where: { id: documentId },
    include: { application: true },
  });
  if (doc.application.userId !== user.id) fail("/apply/documents", "Not your document.");
  if (!isEditable(doc.application.status)) {
    fail("/apply/documents", "Your application can no longer be edited.");
  }
  if (!doc.extracted) fail("/apply/documents", "Run the AI extraction first.");

  const extracted = doc.extracted as { subjects: { subject: string; grade: string }[] };
  await db.application.update({
    where: { id: doc.applicationId },
    data: { results: JSON.parse(JSON.stringify(extracted.subjects)) },
  });

  redirect("/apply/application");
}

// ─── Applicant: application fee (voucher or online payment) ───

export async function redeemVoucher(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  const serial = String(formData.get("serial")).trim().toUpperCase();
  const pin = String(formData.get("pin")).trim();

  const voucher = await db.voucher.findFirst({ where: { cycleId: app.cycleId, serial } });
  if (!voucher || voucher.pin !== pin) fail("/apply/payments", "Invalid voucher serial or PIN.");

  // Atomic claim — two concurrent redeems can't both succeed.
  const claimed = await db.voucher.updateMany({
    where: { id: voucher.id, status: { in: ["GENERATED", "SOLD"] } },
    data: { status: "REDEEMED", redeemedById: user.id, redeemedAt: new Date() },
  });
  if (claimed.count === 0) fail("/apply/payments", "This voucher has already been used.");

  await audit({
    actorId: user.id, action: "admissions.voucher_redeemed", entityType: "Voucher", entityId: voucher.id,
  });

  redirect("/apply/payments");
}

export async function payApplicationFee(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  const cycle = await db.admissionCycle.findUniqueOrThrow({ where: { id: app.cycleId } });

  let invoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "APPLICATION", meta: { path: ["applicationId"], equals: app.id } },
  });
  if (!invoice) {
    invoice = await db.invoice.create({
      data: {
        invoiceNo: `INV-APP-${Date.now().toString(36).toUpperCase()}`,
        kind: "APPLICATION",
        userId: user.id,
        total: cycle.applicationFee,
        meta: { applicationId: app.id },
        lines: { create: [{ description: "Application processing fee", amount: cycle.applicationFee }] },
      },
    });
  }

  const result = await beginInvoicePayment({
    invoiceId: invoice.id,
    userEmail: user.email,
    returnTo: "/apply/payments",
  });
  if (result.kind === "failed") fail("/apply/payments", result.message);
  redirect(result.kind === "redirect" ? result.url : "/apply/payments?paid=1");
}

/** True once the application fee is cleared, by voucher or by payment. */
export async function isApplicationFeeCleared(applicationId: string, userId: string, cycleId: string) {
  const [invoice, voucher] = await Promise.all([
    db.invoice.findFirst({
      where: { userId, kind: "APPLICATION", status: "PAID", meta: { path: ["applicationId"], equals: applicationId } },
    }),
    db.voucher.findFirst({ where: { cycleId, redeemedById: userId, status: "REDEEMED" } }),
  ]);
  return !!invoice || !!voucher;
}

// ─── Applicant: submit ───

export async function submitApplication(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await db.application.findFirstOrThrow({
    where: { id: applicationId, userId: user.id },
    include: { choices: true, documents: true },
  });
  const back = "/apply/application";

  if (!isEditable(app.status)) fail(back, "This application has already been submitted.");
  if (!app.surname || !app.firstName) fail(back, "Fill in and save your personal details first.");
  if (app.choices.length === 0) fail(back, "Choose at least one programme.");
  if (!app.results || (app.results as unknown[]).length === 0) fail(back, "Add your examination results (or apply them from your uploaded results slip).");
  if (app.documents.length === 0) fail(back, "Upload at least one supporting document.");
  if (!(await isApplicationFeeCleared(app.id, user.id, app.cycleId))) {
    fail(back, "Pay the application fee (or redeem a voucher) before submitting.");
  }

  const wasInfoRequested = app.status === "INFO_REQUESTED";
  await db.application.update({
    where: { id: app.id },
    data: {
      status: wasInfoRequested ? "UNDER_REVIEW" : "SUBMITTED",
      infoRequest: wasInfoRequested ? null : app.infoRequest,
      submittedAt: app.submittedAt ?? new Date(),
    },
  });
  await audit({
    actorId: user.id, action: "admissions.application_submitted", entityType: "Application", entityId: app.id,
  });
  await notify(
    user.id,
    wasInfoRequested ? "Application updated" : "Application submitted",
    wasInfoRequested
      ? `Thanks — your updates to ${app.refNo} are back with the admissions office.`
      : `We received your application ${app.refNo}. You'll be notified as soon as it is reviewed.`,
    "/apply"
  );

  redirect("/apply");
}

// ─── Applicant: offer response ───

function offerExpired(offer: { expiresAt: Date | null; acceptedAt: Date | null }) {
  return !offer.acceptedAt && !!offer.expiresAt && offer.expiresAt.getTime() < Date.now();
}

export async function acceptOffer(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  if (app.status !== "OFFER_ISSUED") fail("/apply/letter", "No active offer to accept.");
  const offer = await db.offer.findUniqueOrThrow({ where: { applicationId: app.id } });
  if (offerExpired(offer)) {
    fail("/apply/letter", "This offer has expired. Contact the admissions office if you still wish to enrol.");
  }
  const cycle = await db.admissionCycle.findUniqueOrThrow({ where: { id: app.cycleId } });

  let invoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "ACCEPTANCE", meta: { path: ["applicationId"], equals: app.id } },
  });
  if (!invoice) {
    invoice = await db.invoice.create({
      data: {
        invoiceNo: `INV-ACC-${Date.now().toString(36).toUpperCase()}`,
        kind: "ACCEPTANCE",
        userId: user.id,
        total: cycle.acceptanceFee,
        meta: { applicationId: app.id },
        lines: { create: [{ description: "Acceptance fee", amount: cycle.acceptanceFee }] },
      },
    });
  }

  redirect("/apply/letter");
}

export async function payAcceptanceFee(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  if (app.status !== "OFFER_ISSUED") fail("/apply/letter", "No active offer.");
  const offer = await db.offer.findUniqueOrThrow({ where: { applicationId: app.id } });
  if (offerExpired(offer)) {
    fail("/apply/letter", "This offer has expired. Contact the admissions office if you still wish to enrol.");
  }

  const invoice = await db.invoice.findFirstOrThrow({
    where: { userId: user.id, kind: "ACCEPTANCE", meta: { path: ["applicationId"], equals: app.id } },
  });

  // Offer acceptance itself happens in settleInvoiceSideEffects once the
  // payment is CONFIRMED — via Paystack callback/webhook or instantly on mock.
  const result = await beginInvoicePayment({
    invoiceId: invoice.id,
    userEmail: user.email,
    returnTo: "/apply/letter",
  });
  if (result.kind === "failed") fail("/apply/letter", result.message);
  redirect(result.kind === "redirect" ? result.url : "/apply/letter?paid=1");
}

export async function declineOffer(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  if (app.status !== "OFFER_ISSUED") fail("/apply/letter", "No active offer.");

  await db.$transaction([
    db.offer.update({ where: { applicationId: app.id }, data: { declinedAt: new Date() } }),
    db.application.update({ where: { id: app.id }, data: { status: "DECLINED" } }),
  ]);
  await audit({
    actorId: user.id, action: "admissions.offer_declined", entityType: "Application", entityId: app.id,
  });

  redirect("/apply");
}

// ─── Applicant: withdraw ───

export async function withdrawApplication(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  if (!["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(app.status)) {
    fail("/apply", "This application can't be withdrawn at its current stage.");
  }

  await db.application.update({ where: { id: app.id }, data: { status: "DRAFT" } });
  await audit({
    actorId: user.id, action: "admissions.application_withdrawn", entityType: "Application", entityId: app.id,
  });
  redirect("/apply?withdrawn=1");
}

// ─── Officer/Registrar: review workflow ───

export async function startReview(formData: FormData) {
  const officer = await requireRole(ROLES.ADMISSIONS_OFFICER, ROLES.SYSTEM_ADMIN);
  const applicationId = String(formData.get("applicationId"));
  await db.application.update({
    where: { id: applicationId },
    data: { status: "UNDER_REVIEW" },
  });
  await audit({ actorId: officer.id, action: "admissions.review_started", entityType: "Application", entityId: applicationId });
  redirect(`/staff/admissions/${applicationId}`);
}

export async function runPrescreenAction(formData: FormData) {
  const officer = await requireRole(ROLES.ADMISSIONS_OFFICER, ROLES.SYSTEM_ADMIN);
  const applicationId = String(formData.get("applicationId"));
  const app = await db.application.findFirstOrThrow({
    where: { id: applicationId },
    include: { choices: { include: { programme: true }, orderBy: { rank: "asc" } }, documents: true },
  });

  const result = await prescreenApplication({
    userId: officer.id,
    programmeName: app.choices[0]?.programme.name ?? "(no programme chosen)",
    entryRequirements: app.choices[0]?.programme.entryRequirements ?? null,
    qualificationType: app.qualificationType,
    results: (app.results as { subject: string; grade: string }[] | null) ?? [],
    documentCount: app.documents.length,
  });

  await db.application.update({
    where: { id: app.id },
    data: { aiPrescreen: JSON.parse(JSON.stringify(result)) },
  });
  redirect(`/staff/admissions/${applicationId}`);
}

export async function requestInfo(formData: FormData) {
  const officer = await requireRole(ROLES.ADMISSIONS_OFFICER, ROLES.SYSTEM_ADMIN);
  const applicationId = String(formData.get("applicationId"));
  const note = String(formData.get("note") ?? "");

  const app = await db.application.update({
    where: { id: applicationId },
    data: { status: "INFO_REQUESTED", infoRequest: note },
  });
  await audit({ actorId: officer.id, action: "admissions.info_requested", entityType: "Application", entityId: applicationId, after: { note } });
  await notify(
    app.userId,
    "Action needed on your application",
    `The admissions office needs more information on ${app.refNo}: ${note}`,
    "/apply"
  );
  redirect(`/staff/admissions/${applicationId}`);
}

export async function recordRecommendation(formData: FormData) {
  const officer = await requireRole(ROLES.ADMISSIONS_OFFICER, ROLES.SYSTEM_ADMIN);
  const applicationId = String(formData.get("applicationId"));
  const recommendation = String(formData.get("recommendation")) as Recommendation;
  const note = String(formData.get("note") ?? "");

  await db.application.update({
    where: { id: applicationId },
    data: { status: "RECOMMENDED", recommendation, decisionNote: note },
  });
  await audit({
    actorId: officer.id, action: "admissions.recommendation_recorded", entityType: "Application",
    entityId: applicationId, after: { recommendation, note },
  });
  redirect(`/staff/admissions/${applicationId}`);
}

/**
 * Final human sign-off (ADM-09): a Registrar confirms the officer's
 * recommendation — issuing an offer, confirming a rejection, or placing the
 * applicant on the waitlist. This is the two-person control the system
 * enforces even when a single super user holds both roles during testing.
 */
export async function approveAndIssueOffer(formData: FormData) {
  const registrar = await requireRole(ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const applicationId = String(formData.get("applicationId"));
  const back = `/staff/admissions/${applicationId}`;
  const app = await db.application.findFirstOrThrow({
    where: { id: applicationId },
    include: { choices: { orderBy: { rank: "asc" } }, user: true, cycle: true },
  });

  if (!["RECOMMENDED", "WAITLISTED"].includes(app.status)) {
    fail(back, "Application has not been recommended yet.");
  }

  if (app.status === "RECOMMENDED" && app.recommendation === "REJECT") {
    await db.application.update({
      where: { id: app.id }, data: { status: "REJECTED", decidedAt: new Date() },
    });
    await audit({
      actorId: registrar.id, action: "admissions.rejection_confirmed", entityType: "Application", entityId: app.id,
    });
    await notify(
      app.userId,
      "Admission decision",
      `A decision has been made on your application ${app.refNo}. Unfortunately it was not successful this cycle.`,
      "/apply"
    );
    redirect(back);
  }

  if (app.status === "RECOMMENDED" && app.recommendation === "WAITLIST") {
    await db.application.update({
      where: { id: app.id }, data: { status: "WAITLISTED" },
    });
    await audit({
      actorId: registrar.id, action: "admissions.waitlisted", entityType: "Application", entityId: app.id,
    });
    await notify(
      app.userId,
      "You are on the waitlist",
      `Your application ${app.refNo} has been placed on the waitlist. You'll be notified immediately if a place opens up.`,
      "/apply"
    );
    redirect(back);
  }

  // OFFER_FIRST_CHOICE / OFFER_ALTERNATIVE — or issuing to a waitlisted applicant.
  const programmeId =
    app.recommendation === "OFFER_ALTERNATIVE"
      ? (app.choices[1]?.programmeId ?? app.choices[0]?.programmeId)
      : app.choices[0]?.programmeId;
  if (!programmeId) fail(back, "Application has no programme choices.");

  const programme = await db.programme.findUniqueOrThrow({ where: { id: programmeId } });
  const code = verificationCode();

  await db.$transaction(async (tx) => {
    await tx.offer.create({
      data: {
        applicationId: app.id,
        programmeId,
        letterCode: code,
        expiresAt: new Date(Date.now() + 21 * 86_400_000),
      },
    });
    await tx.issuedDocument.create({
      data: {
        type: "ADMISSION_LETTER",
        code,
        title: `Admission Letter — ${app.refNo}`,
        userId: app.userId,
        payload: {
          applicantName: [app.surname, app.firstName].filter(Boolean).join(", ") || app.user.name,
          programmeName: programme.name,
          refNo: app.refNo,
          cycleName: app.cycle.name,
          issuedAt: new Date().toISOString(),
        },
      },
    });
    await tx.application.update({
      where: { id: app.id },
      data: { status: "OFFER_ISSUED", decidedAt: new Date() },
    });
  });

  await audit({
    actorId: registrar.id, action: "admissions.offer_issued", entityType: "Application",
    entityId: applicationId, after: { programmeId, letterCode: code },
  });
  await notify(
    app.userId,
    "🎉 Admission offer issued",
    `Congratulations — you have been offered admission to ${programme.name}. Open your admission letter to accept.`,
    "/apply/letter"
  );
  redirect(back);
}
