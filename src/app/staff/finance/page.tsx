import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { confirmTellerPayment, generateSemesterBills, rejectTellerPayment } from "@/lib/actions/finance";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  await requirePortal("staff");

  const semester = await db.semester.findFirst({ where: { isCurrent: true } });
  const invoices = semester
    ? await db.invoice.findMany({
        where: { semesterId: semester.id, kind: "TUITION" },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const pendingTellers = await db.payment.findMany({
    where: { channel: "TELLER", status: "PENDING" },
    include: { invoice: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  const totalBilled = invoices.reduce((s, i) => s + i.total, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.paid, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Finance</h1>
      <p className="mt-1 text-sm text-ink-500">{semester?.label ?? "No current semester"}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-ink-300/60 bg-white p-4"><div className="text-xs text-ink-500">Bills issued</div><div className="text-lg font-bold">{invoices.length}</div></div>
        <div className="rounded-lg border border-ink-300/60 bg-white p-4"><div className="text-xs text-ink-500">Total billed</div><div className="text-lg font-bold">{formatGHS(totalBilled)}</div></div>
        <div className="rounded-lg border border-ink-300/60 bg-white p-4"><div className="text-xs text-ink-500">Total collected</div><div className="text-lg font-bold text-brand-800">{formatGHS(totalCollected)}</div></div>
      </div>

      <form action={generateSemesterBills} className="mt-4">
        <button type="submit" className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Generate semester bills
        </button>
        <span className="ml-3 text-xs text-ink-500">Safe to click again — skips students already billed.</span>
      </form>

      <h2 className="mt-8 font-semibold text-ink-700">Bank-teller confirmations pending</h2>
      <div className="mt-3 space-y-3">
        {pendingTellers.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <div>
              <div className="font-medium">{p.invoice.user.name}</div>
              <div className="text-xs text-ink-500">{formatGHS(p.amount)} · ref {(p.meta as { tellerRef?: string } | null)?.tellerRef ?? "—"}</div>
            </div>
            <div className="flex gap-2">
              <form action={confirmTellerPayment}><input type="hidden" name="paymentId" value={p.id} /><button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">Confirm</button></form>
              <form action={rejectTellerPayment}><input type="hidden" name="paymentId" value={p.id} /><button type="submit" className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100">Reject</button></form>
            </div>
          </div>
        ))}
        {pendingTellers.length === 0 && <p className="text-sm text-ink-500">None pending.</p>}
      </div>

      <h2 className="mt-8 font-semibold text-ink-700">Student bills</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-ink-300/60 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">Student</th><th className="px-4 py-2">Total</th><th className="px-4 py-2">Paid</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-ink-100">
                <td className="px-4 py-2">{inv.user.name}</td>
                <td className="px-4 py-2">{formatGHS(inv.total)}</td>
                <td className="px-4 py-2">{formatGHS(inv.paid)}</td>
                <td className="px-4 py-2">{inv.status}</td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No bills generated yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
