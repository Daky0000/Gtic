"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo, verificationCode } from "@/lib/codes";
import { beginInvoicePayment } from "@/lib/payments";
import { notify } from "@/lib/notify";
import { getIntFee, SETTING_KEYS, type SettingKey } from "@/lib/settings";
import type { Audience, DocRequestType } from "@prisma/client";

export async function publishAnnouncement(formData: FormData) {
  const staff = await requireRole(ROLES.REGISTRAR, ROLES.MANAGEMENT, ROLES.SYSTEM_ADMIN);
  await db.announcement.create({
    data: {
      title: String(formData.get("title")),
      body: String(formData.get("body")),
      audience: String(formData.get("audience")) as Audience,
      authorId: staff.id,
    },
  });
  await audit({ actorId: staff.id, action: "comms.announcement_published", entityType: "Announcement" });
  redirect("/staff/announcements");
}

// Defaults in pesewas; the developer console can override each via settings.
const DOC_FEE_DEFAULTS: Record<DocRequestType, { key: SettingKey; amount: number }> = {
  TRANSCRIPT: { key: SETTING_KEYS.DOC_FEE_TRANSCRIPT, amount: 5000 }, // GHS 50 (requested/mailed copy; the transcript page generates free)
  ATTESTATION: { key: SETTING_KEYS.DOC_FEE_ATTESTATION, amount: 3000 },
  VERIFICATION_LETTER: { key: SETTING_KEYS.DOC_FEE_VERIFICATION_LETTER, amount: 2000 },
};

export async function documentFee(type: DocRequestType): Promise<number> {
  const cfg = DOC_FEE_DEFAULTS[type];
  return getIntFee(cfg.key, cfg.amount);
}

export async function requestDocument(formData: FormData) {
  const user = await requireUser();
  const type = String(formData.get("type")) as DocRequestType;
  const note = String(formData.get("note") ?? "");
  const fee = await documentFee(type);

  const invoice = await db.invoice.create({
    data: {
      invoiceNo: invoiceNo("DOC"),
      kind: "DOCUMENT",
      userId: user.id,
      total: fee,
      lines: { create: [{ description: `${type.replace("_", " ")} request fee`, amount: fee }] },
    },
  });
  await db.documentRequest.create({
    data: { userId: user.id, type, note, invoiceId: invoice.id },
  });

  redirect("/student/requests");
}

export async function payDocumentFee(formData: FormData) {
  const user = await requireUser();
  const requestId = String(formData.get("requestId"));
  const request = await db.documentRequest.findFirstOrThrow({ where: { id: requestId, userId: user.id } });
  if (!request.invoiceId) {
    redirect(`/student/requests?error=${encodeURIComponent("No invoice is linked to this request.")}`);
  }

  // The request moves to QUEUED in settleInvoiceSideEffects once payment confirms.
  const result = await beginInvoicePayment({
    invoiceId: request.invoiceId,
    userEmail: user.email,
    returnTo: "/student/requests",
  });
  if (result.kind === "failed") {
    redirect(`/student/requests?error=${encodeURIComponent(result.message)}`);
  }
  redirect(result.kind === "redirect" ? result.url : "/student/requests?paid=1");
}

export async function processDocumentRequest(formData: FormData) {
  const officer = await requireRole(ROLES.EXAMS_OFFICER, ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const requestId = String(formData.get("requestId"));
  const request = await db.documentRequest.findUniqueOrThrow({ where: { id: requestId }, include: { user: true } });
  if (request.status !== "QUEUED") {
    redirect(`/staff/documents?error=${encodeURIComponent("This request is not ready for processing (fee may be unpaid).")}`);
  }

  const code = verificationCode();
  await db.$transaction(async (tx) => {
    const issued = await tx.issuedDocument.create({
      data: {
        type: request.type === "TRANSCRIPT" ? "TRANSCRIPT" : "ATTESTATION",
        code,
        title: `${request.type.replace("_", " ")} — ${request.user.name}`,
        userId: request.userId,
        payload: { requestedBy: request.user.name, type: request.type, issuedAt: new Date().toISOString() },
      },
    });
    await tx.documentRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", completedAt: new Date(), issuedDocId: issued.id },
    });
  });

  await audit({ actorId: officer.id, action: "documents.request_completed", entityType: "DocumentRequest", entityId: requestId });
  await notify(
    request.userId,
    "Your document is ready",
    `Your ${request.type.replace("_", " ").toLowerCase()} has been issued with verification code ${code}.`,
    "/student/requests"
  );
  redirect("/staff/documents");
}

export async function rejectDocumentRequest(formData: FormData) {
  const officer = await requireRole(ROLES.EXAMS_OFFICER, ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const requestId = String(formData.get("requestId"));
  const request = await db.documentRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
  await audit({ actorId: officer.id, action: "documents.request_rejected", entityType: "DocumentRequest", entityId: requestId });
  await notify(
    request.userId,
    "Document request rejected",
    `Your ${request.type.replace("_", " ").toLowerCase()} request was rejected. Contact the registry for details.`,
    "/student/requests"
  );
  redirect("/staff/documents");
}
