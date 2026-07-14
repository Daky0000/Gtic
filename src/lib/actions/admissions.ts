"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { applicationRefNo, verificationCode } from "@/lib/codes";
import { saveUpload } from "@/lib/storage";
import { payInvoiceMock } from "@/lib/payments";
import { extractApplicationDocument, prescreenApplication } from "@/lib/ai/tasks";
import type { ApplicationDocKind, Recommendation } from "@prisma/client";

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
  if (!cycle) return null;

  const existing = await db.application.findFirst({
    where: { userId, cycleId: cycle.id },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

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

  if (!["DRAFT", "INFO_REQUESTED"].includes(app.status)) {
    throw new Error("This application can no longer be edited.");
  }

  const str = (k: string) => (formData.get(k) ? String(formData.get(k)) : null);
  const dob = str("dateOfBirth");

  const results: { subject: string; grade: string }[] = [];
  for (let i = 0; i < 9; i++) {
    const subject = str(`subject_${i}`);
    const grade = str(`grade_${i}`);
    if (subject && grade) results.push({ subject, grade });
  }

  const choiceIds = [str("choice1"), str("choice2"), str("choice3")].filter(Boolean) as string[];

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
        phone: str("phone"),
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

  redirect("/apply/application");
}

// ─── Applicant: documents + AI extraction ───

export async function uploadApplicationDocument(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  const kind = String(formData.get("kind")) as ApplicationDocKind;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a file to upload.");

  const saved = await saveUpload(file, `applications/${app.id}`);
  await db.applicationDocument.create({
    data: { applicationId: app.id, kind, ...saved },
  });

  redirect("/apply/documents");
}

export async function runDocumentExtractionAction(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const doc = await db.applicationDocument.findFirstOrThrow({
    where: { id: documentId },
    include: { application: true },
  });
  if (doc.application.userId !== user.id) throw new Error("Not your document.");

  const { result } = await extractApplicationDocument({
    userId: user.id,
    filePath: doc.filePath,
    mimeType: doc.mimeType,
  });
  await db.applicationDocument.update({
    where: { id: doc.id },
    data: { extracted: JSON.parse(JSON.stringify(result)) },
  });

  redirect("/apply/documents");
}

export async function applyExtractedResults(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const doc = await db.applicationDocument.findFirstOrThrow({
    where: { id: documentId },
    include: { application: true },
  });
  if (doc.application.userId !== user.id) throw new Error("Not your document.");
  if (!doc.extracted) throw new Error("No extraction to apply yet.");

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
  if (!voucher || voucher.pin !== pin) throw new Error("Invalid voucher serial or PIN.");
  if (voucher.status === "REDEEMED") throw new Error("This voucher has already been used.");

  await db.voucher.update({
    where: { id: voucher.id },
    data: { status: "REDEEMED", redeemedById: user.id, redeemedAt: new Date() },
  });
  await audit({
    actorId: user.id, action: "admissions.voucher_redeemed", entityType: "Voucher", entityId: voucher.id,
  });

  redirect("/apply/payments");
}

export async function payApplicationFeeMock(formData: FormData) {
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
  if (invoice.status !== "PAID") {
    await payInvoiceMock(invoice.id, invoice.total - invoice.paid, user.id);
  }

  redirect("/apply/payments");
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

  if (!["DRAFT", "INFO_REQUESTED"].includes(app.status)) throw new Error("Already submitted.");
  if (app.choices.length === 0) throw new Error("Choose at least one programme.");
  if (!app.results || (app.results as unknown[]).length === 0) throw new Error("Add your examination results.");
  if (app.documents.length === 0) throw new Error("Upload at least one supporting document.");
  if (!(await isApplicationFeeCleared(app.id, user.id, app.cycleId))) {
    throw new Error("Pay the application fee (or redeem a voucher) before submitting.");
  }

  const wasInfoRequested = app.status === "INFO_REQUESTED";
  await db.application.update({
    where: { id: app.id },
    data: {
      status: wasInfoRequested ? "UNDER_REVIEW" : "SUBMITTED",
      submittedAt: app.submittedAt ?? new Date(),
    },
  });
  await audit({
    actorId: user.id, action: "admissions.application_submitted", entityType: "Application", entityId: app.id,
  });

  redirect("/apply");
}

// ─── Applicant: offer response ───

export async function acceptOffer(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  if (app.status !== "OFFER_ISSUED") throw new Error("No active offer to accept.");
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

export async function payAcceptanceFeeMock(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  if (app.status !== "OFFER_ISSUED") throw new Error("No active offer.");

  const invoice = await db.invoice.findFirstOrThrow({
    where: { userId: user.id, kind: "ACCEPTANCE", meta: { path: ["applicationId"], equals: app.id } },
  });
  if (invoice.status !== "PAID") {
    await payInvoiceMock(invoice.id, invoice.total - invoice.paid, user.id);
  }

  await db.$transaction([
    db.offer.update({ where: { applicationId: app.id }, data: { acceptedAt: new Date() } }),
    db.application.update({ where: { id: app.id }, data: { status: "ACCEPTED" } }),
  ]);
  await audit({
    actorId: user.id, action: "admissions.offer_accepted", entityType: "Application", entityId: app.id,
  });

  redirect("/apply/letter");
}

export async function declineOffer(formData: FormData) {
  const user = await requireUser();
  const applicationId = String(formData.get("applicationId"));
  const app = await getOwnApplication(applicationId, user.id);
  if (app.status !== "OFFER_ISSUED") throw new Error("No active offer.");

  await db.$transaction([
    db.offer.update({ where: { applicationId: app.id }, data: { declinedAt: new Date() } }),
    db.application.update({ where: { id: app.id }, data: { status: "DECLINED" } }),
  ]);
  await audit({
    actorId: user.id, action: "admissions.offer_declined", entityType: "Application", entityId: app.id,
  });

  redirect("/apply");
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

  await db.application.update({
    where: { id: applicationId },
    data: { status: "INFO_REQUESTED", infoRequest: note },
  });
  await audit({ actorId: officer.id, action: "admissions.info_requested", entityType: "Application", entityId: applicationId, after: { note } });
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
 * Final human sign-off (ADM-09): a Registrar approves the officer's
 * recommendation and — only then — the offer is issued. This is the
 * two-person control the system enforces even though a single super user
 * may hold both roles during testing.
 */
export async function approveAndIssueOffer(formData: FormData) {
  const registrar = await requireRole(ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const applicationId = String(formData.get("applicationId"));
  const app = await db.application.findFirstOrThrow({
    where: { id: applicationId },
    include: { choices: { orderBy: { rank: "asc" } }, user: true, cycle: true },
  });

  if (app.status !== "RECOMMENDED") throw new Error("Application has not been recommended yet.");

  if (app.recommendation === "REJECT") {
    await db.application.update({
      where: { id: app.id }, data: { status: "REJECTED", decidedAt: new Date() },
    });
    redirect(`/staff/admissions/${applicationId}`);
  }
  if (app.recommendation === "WAITLIST") {
    throw new Error("This application is waitlisted — no offer can be issued yet.");
  }

  const programmeId =
    app.recommendation === "OFFER_ALTERNATIVE"
      ? (app.choices[1]?.programmeId ?? app.choices[0]?.programmeId)
      : app.choices[0]?.programmeId;
  if (!programmeId) throw new Error("Application has no programme choices.");

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
  redirect(`/staff/admissions/${applicationId}`);
}
