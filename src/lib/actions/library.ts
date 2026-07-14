"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo } from "@/lib/codes";

const LOAN_DAYS = 14;
const FINE_PER_DAY = 100; // GHS 1.00/day, pesewas

export async function borrowItem(formData: FormData) {
  const librarian = await requireRole(ROLES.LIBRARIAN, ROLES.SYSTEM_ADMIN);
  const itemId = String(formData.get("itemId"));
  const email = String(formData.get("email")).trim().toLowerCase();

  const [item, user] = await Promise.all([
    db.libraryItem.findUniqueOrThrow({ where: { id: itemId } }),
    db.user.findUnique({ where: { email } }),
  ]);
  if (!user) throw new Error(`No account found for ${email}.`);
  if (item.copiesAvailable <= 0) throw new Error("No copies available.");

  await db.$transaction([
    db.libraryItem.update({ where: { id: itemId }, data: { copiesAvailable: { decrement: 1 } } }),
    db.loan.create({
      data: { itemId, userId: user.id, dueAt: new Date(Date.now() + LOAN_DAYS * 86_400_000) },
    }),
  ]);
  await audit({ actorId: librarian.id, action: "library.item_borrowed", entityType: "LibraryItem", entityId: itemId, after: { userId: user.id } });
  redirect("/staff/library");
}

export async function returnItem(formData: FormData) {
  const librarian = await requireRole(ROLES.LIBRARIAN, ROLES.SYSTEM_ADMIN);
  const loanId = String(formData.get("loanId"));
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.returnedAt) return redirect("/staff/library");

  const now = new Date();
  const daysLate = Math.max(0, Math.ceil((now.getTime() - loan.dueAt.getTime()) / 86_400_000));
  const fine = daysLate * FINE_PER_DAY;

  await db.$transaction(async (tx) => {
    await tx.loan.update({ where: { id: loanId }, data: { returnedAt: now } });
    await tx.libraryItem.update({ where: { id: loan.itemId }, data: { copiesAvailable: { increment: 1 } } });
    if (fine > 0) {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNo: invoiceNo("FIN"),
          kind: "FINE",
          userId: loan.userId,
          total: fine,
          lines: { create: [{ description: `Overdue fine (${daysLate} day(s))`, amount: fine }] },
        },
      });
      await tx.loan.update({ where: { id: loanId }, data: { fineInvoiceId: invoice.id } });
    }
  });
  await audit({ actorId: librarian.id, action: "library.item_returned", entityType: "Loan", entityId: loanId, after: { daysLate, fine } });
  redirect("/staff/library");
}
