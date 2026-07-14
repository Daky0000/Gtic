import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { payTuitionMock, recordTellerPayment } from "@/lib/actions/finance";

export const metadata = { title: "Fees & Payments" };

export default async function FeesPage() {
  const user = await requirePortal("student");
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const invoices = await db.invoice.findMany({
    where: { studentId: student.id },
    include: { lines: true, payments: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Fees &amp; payments</h1>

      {invoices.length === 0 && <p className="mt-4 text-sm text-ink-500">No bills issued yet.</p>}

      {invoices.map((inv) => {
        const balance = inv.total - inv.paid;
        return (
          <section key={inv.id} className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-brand-800">{inv.kind.replace("_", " ")}</div>
                <div className="text-xs text-ink-500 font-mono">{inv.invoiceNo}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inv.status === "PAID" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}`}>
                {inv.status.replace("_", " ")}
              </span>
            </div>

            <table className="mt-3 w-full text-left text-sm">
              <tbody>
                {inv.lines.map((l) => (
                  <tr key={l.id} className="border-b border-ink-100"><td className="py-1">{l.description}</td><td className="py-1 text-right font-mono">{formatGHS(l.amount)}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-300 font-semibold"><td className="pt-2">Total</td><td className="pt-2 text-right font-mono">{formatGHS(inv.total)}</td></tr>
                <tr><td className="text-ink-500">Paid</td><td className="text-right font-mono text-ink-500">{formatGHS(inv.paid)}</td></tr>
                <tr className="font-semibold"><td>Balance</td><td className="text-right font-mono">{formatGHS(balance)}</td></tr>
              </tfoot>
            </table>

            {balance > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <form action={payTuitionMock}>
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <button type="submit" className="w-full rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Pay {formatGHS(balance)} online
                  </button>
                </form>
                <form action={recordTellerPayment} className="flex gap-2">
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <input name="tellerRef" placeholder="Teller ref" required className="w-24 rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
                  <input name="amount" type="number" step="0.01" placeholder="GHS" required className="w-20 rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
                  <button type="submit" className="rounded-md border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100">Submit</button>
                </form>
              </div>
            )}

            {inv.payments.filter((p) => p.status !== "FAILED").map((p) => (
              <div key={p.id} className="mt-2 text-xs text-ink-500">
                {formatGHS(p.amount)} via {p.channel} — {p.status.toLowerCase()} {p.reference && `(${p.reference})`}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
