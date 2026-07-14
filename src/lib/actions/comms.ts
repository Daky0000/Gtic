"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo, verificationCode } from "@/lib/codes";
import { payInvoiceMock } from "@/lib/payments";
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

const DOC_FEES: Record<DocRequestType, number> = {
  TRANSCRIPT: 5000, // GHS 50 (official transcripts also generate free on the transcript page — this is the requested/mailed copy)
  ATTESTATION: 3000,
  VERIFICATION_LETTER: 2000,
};

export async function requestDocument(formData: FormData) {
  const user = await requireUser();
  const type = String(formData.get("type")) as DocRequestType;
  const note = String(formData.get("note") ?? "");

  const invoice = await db.invoice.create({
    data: {
      invoiceNo: invoiceNo("DOC"),
      kind: "DOCUMENT",
      userId: user.id,
      total: DOC_FEES[type],
      lines: { create: [{ description: `${type.replace("_", " ")} request fee`, amount: DOC_FEES[type] }] },
    },
  });
  await db.documentRequest.create({
    data: { userId: user.id, type, note, invoiceId: invoice.id },
  });

  redirect("/student/requests");
}

export async function payDocumentFeeMock(formData: FormData) {
  const user = await requireUser();
  const requestId = String(formData.get("requestId"));
  const request = await db.documentRequest.findFirstOrThrow({ where: { id: requestId, userId: user.id } });
  if (!request.invoiceId) throw new Error("No invoice linked to this request.");

  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: request.invoiceId } });
  await payInvoiceMock(invoice.id, invoice.total - invoice.paid, user.id);
  await db.documentRequest.update({ where: { id: requestId }, data: { status: "QUEUED" } });

  redirect("/student/requests");
}

export async function processDocumentRequest(formData: FormData) {
  const officer = await requireRole(ROLES.EXAMS_OFFICER, ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const requestId = String(formData.get("requestId"));
  const request = await db.documentRequest.findUniqueOrThrow({ where: { id: requestId }, include: { user: true } });
  if (request.status !== "QUEUED") throw new Error("This request is not ready for processing.");

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
  redirect("/staff/documents");
}

export async function rejectDocumentRequest(formData: FormData) {
  const officer = await requireRole(ROLES.EXAMS_OFFICER, ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const requestId = String(formData.get("requestId"));
  await db.documentRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
  await audit({ actorId: officer.id, action: "documents.request_rejected", entityType: "DocumentRequest", entityId: requestId });
  redirect("/staff/documents");
}
