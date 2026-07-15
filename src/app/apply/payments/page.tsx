import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import {
  getOrCreateDraftApplication, isApplicationFeeCleared, payApplicationFee, redeemVoucher,
} from "@/lib/actions/admissions";
import { isPaystackConfigured } from "@/lib/paystack";
import { Flash } from "@/components/flash";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  const user = await requirePortal("apply");
  const { error, paid } = await searchParams;
  const app = await getOrCreateDraftApplication(user.id);
  if (!app) redirect("/apply");

  const cycle = await db.admissionCycle.findUniqueOrThrow({ where: { id: app.cycleId } });
  const feeCleared = await isApplicationFeeCleared(app.id, user.id, app.cycleId);
  const paystackReady = await isPaystackConfigured();

  const applicationInvoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "APPLICATION", meta: { path: ["applicationId"], equals: app.id } },
    include: { payments: true },
  });
  const acceptanceInvoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "ACCEPTANCE", meta: { path: ["applicationId"], equals: app.id } },
    include: { payments: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Payments</h1>
      <Flash error={error} success={paid ? "Payment received — thank you." : undefined} />

      <section className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-800">Application fee</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${feeCleared ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}`}>
            {feeCleared ? "Cleared" : "Not yet paid"}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-500">{formatGHS(cycle.applicationFee)}</p>

        {!feeCleared && (
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <form action={payApplicationFee}>
              <input type="hidden" name="applicationId" value={app.id} />
              <h3 className="text-sm font-medium text-ink-700">Pay online</h3>
              <p className="text-xs text-ink-500">
                {paystackReady
                  ? "Card or mobile money (MTN, Telecel, AT) — secure checkout via Paystack."
                  : "Card or mobile money (demo payment — settles instantly)."}
              </p>
              <button type="submit" className="mt-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Pay {formatGHS(cycle.applicationFee)}
              </button>
            </form>
            <form action={redeemVoucher}>
              <input type="hidden" name="applicationId" value={app.id} />
              <h3 className="text-sm font-medium text-ink-700">Redeem a voucher</h3>
              <div className="mt-2 flex gap-2">
                <input name="serial" placeholder="Serial" required className="w-28 rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
                <input name="pin" placeholder="PIN" required className="w-24 rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
              </div>
              <button type="submit" className="mt-2 rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
                Redeem
              </button>
            </form>
          </div>
        )}
        {applicationInvoice?.payments
          .filter((p) => p.status !== "FAILED")
          .map((p) => (
            <div key={p.id} className="mt-3 text-xs text-ink-500">
              {p.status === "CONFIRMED" ? "Paid" : "Pending"} {formatGHS(p.amount)} via {p.channel} · ref {p.reference}
            </div>
          ))}
      </section>

      {(app.status === "OFFER_ISSUED" || app.status === "ACCEPTED") && (
        <section className="mt-6 rounded-lg border border-ink-300/60 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-brand-800">Acceptance fee</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${acceptanceInvoice?.status === "PAID" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}`}>
              {acceptanceInvoice?.status === "PAID" ? "Paid" : "Not yet paid"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-500">{formatGHS(cycle.acceptanceFee)}</p>
          <p className="mt-2 text-sm text-ink-600">Pay this from your admission letter page once you accept the offer.</p>
        </section>
      )}
    </div>
  );
}
