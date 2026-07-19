"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { invoiceNo } from "@/lib/codes";
import { notify } from "@/lib/notify";
import { formatGHS } from "@/lib/money";
import { getIntFee, SETTING_KEYS } from "@/lib/settings";

const LOAN_DAYS = 14;
const DEFAULT_FINE_PER_DAY = 100; // GHS 1.00/day, pesewas

// The per-day fine is priced from the fees console (developer-set), falling
// back to the default above when unset.
const finePerDay = () => getIntFee(SETTING_KEYS.LIBRARY_FINE_PER_DAY, DEFAULT_FINE_PER_DAY);

function fail(message: string): never {
  redirect(`/staff/library?error=${encodeURIComponent(message)}`);
}

export async function borrowItem(formData: FormData) {
  const librarian = await requireRole(ROLES.LIBRARIAN, ROLES.SYSTEM_ADMIN);
  const itemId = String(formData.get("itemId"));
  const email = String(formData.get("email")).trim().toLowerCase();

  const [item, user] = await Promise.all([
    db.libraryItem.findUniqueOrThrow({ where: { id: itemId } }),
    db.user.findUnique({ where: { email } }),
  ]);
  if (!user) fail(`No account found for ${email}.`);
  if (item.copiesAvailable <= 0) fail("No copies available.");

  const dueAt = new Date(Date.now() + LOAN_DAYS * 86_400_000);
  await db.$transaction([
    db.libraryItem.update({ where: { id: itemId }, data: { copiesAvailable: { decrement: 1 } } }),
    db.loan.create({ data: { itemId, userId: user.id, dueAt } }),
  ]);
  await audit({ actorId: librarian.id, action: "library.item_borrowed", entityType: "LibraryItem", entityId: itemId, after: { userId: user.id } });
  await notify(
    user.id,
    "Library loan recorded",
    `"${item.title}" is due back by ${dueAt.toLocaleDateString()}. Late returns attract a fine of ${formatGHS(await finePerDay())} per day.`
  );
  redirect("/staff/library");
}

export async function returnItem(formData: FormData) {
  const librarian = await requireRole(ROLES.LIBRARIAN, ROLES.SYSTEM_ADMIN);
  const loanId = String(formData.get("loanId"));
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.returnedAt) return redirect("/staff/library");

  const now = new Date();
  const daysLate = Math.max(0, Math.ceil((now.getTime() - loan.dueAt.getTime()) / 86_400_000));
  const fine = daysLate * (await finePerDay());

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
  if (fine > 0) {
    await notify(
      loan.userId,
      "Overdue library fine",
      `Your return was ${daysLate} day(s) late — a fine of ${formatGHS(fine)} has been billed to your account.`,
      "/student/fees"
    );
  }
  redirect("/staff/library");
}
