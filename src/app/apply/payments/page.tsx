import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import {
  getOrCreateDraftApplication, isApplicationFeeCleared, payApplicationFee, redeemVoucher,
} from "@/lib/actions/admissions";
import { isPaystackConfigured } from "@/lib/paystack";
import { getCheckoutAmount, reconcilePendingPaystackPayments } from "@/lib/payments";
import { Flash } from "@/components/flash";
import { PageHeader, Card, StatusChip } from "@/components/ui";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paid?: string; redeemed?: string }>;
}) {
  const user = await requirePortal("apply");
  const { error, paid, redeemed } = await searchParams;
  const app = await getOrCreateDraftApplication(user.id);
  if (!app) redirect("/apply");

  // Settle any checkout the payer completed but never returned from (covers
  // deployments where the Paystack dashboard webhook isn't configured).
  const reconciled = await reconcilePendingPaystackPayments(user.id);

  const cycle = await db.admissionCycle.findUniqueOrThrow({ where: { id: app.cycleId } });
  const feeCleared = await isApplicationFeeCleared(app.id, user.id, app.cycleId);
  const paystackReady = await isPaystackConfigured();
  const checkout = await getCheckoutAmount(cycle.applicationFee);

  const applicationInvoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "APPLICATION", meta: { path: ["applicationId"], equals: app.id } },
    include: { payments: true },
  });
  const acceptanceInvoice = await db.invoice.findFirst({
    where: { userId: user.id, kind: "ACCEPTANCE", meta: { path: ["applicationId"], equals: app.id } },
    include: { payments: true },
  });
  const hasPendingCheckout = !!applicationInvoice?.payments.some(
    (p) => p.channel === "PAYSTACK" && p.status === "PENDING"
  );

  return (
    <div className="scr mx-auto max-w-2xl">
      <PageHeader
        title={<>Fees &amp; <em className="text-forest">payment.</em></>}
        lead="Your fee breakdown and how to pay."
      />
      <Flash
        error={error}
        success={
          paid || reconciled
            ? "Payment received — thank you."
            : redeemed
              ? "Voucher redeemed — your application fee is cleared."
              : undefined
        }
      />

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[20px] text-ink">Application fee</h2>
          <StatusChip tone={feeCleared ? "green" : "amber"}>
            {feeCleared ? "Cleared" : "Not yet paid"}
          </StatusChip>
        </div>
        <p className="mt-1 font-serif text-[26px] text-forest">{formatGHS(cycle.applicationFee)}</p>

        {!feeCleared && (
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <form action={payApplicationFee}>
              <input type="hidden" name="applicationId" value={app.id} />
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Pay online</div>
              <p className="mt-1 text-xs text-muted">
                {hasPendingCheckout
                  ? "You have a checkout in progress — continuing takes you back to the same secure Paystack page, so you can never be charged twice."
                  : paystackReady
                    ? `Card or mobile money (MTN, Telecel, AT) — secure checkout via Paystack.${checkout.fee > 0 ? ` Includes a ${checkout.percent}% processing fee.` : ""}`
                    : "Card or mobile money (demo payment — settles instantly)."}
              </p>
              <button
                type="submit"
                className="mt-3 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-deep"
              >
                {hasPendingCheckout ? "Continue payment" : `Pay ${formatGHS(checkout.total)}`}
              </button>
            </form>
            <form action={redeemVoucher}>
              <input type="hidden" name="applicationId" value={app.id} />
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Redeem a voucher</div>
              <div className="mt-2 flex gap-2">
                <input name="serial" placeholder="Serial" required className="field !w-28 !py-2 !text-sm" />
                <input name="pin" placeholder="PIN" required className="field !w-24 !py-2 !text-sm" />
              </div>
              <button
                type="submit"
                className="mt-3 rounded-full border border-line px-5 py-2.5 text-sm font-medium text-forest transition-colors hover:border-forest"
              >
                Redeem
              </button>
            </form>
          </div>
        )}
        {applicationInvoice?.payments
          .filter((p) => p.status !== "FAILED")
          .map((p) => (
            <div key={p.id} className="mt-3 text-xs text-muted">
              {p.status === "CONFIRMED" ? "Paid" : "Pending"} {formatGHS(p.amount)} via {p.channel} · ref {p.reference}
            </div>
          ))}
      </Card>

      {(app.status === "OFFER_ISSUED" || app.status === "ACCEPTED") && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[20px] text-ink">Enrollment fee</h2>
            <StatusChip tone={acceptanceInvoice?.status === "PAID" ? "green" : "amber"}>
              {acceptanceInvoice?.status === "PAID" ? "Paid" : "Not yet paid"}
            </StatusChip>
          </div>
          <p className="mt-1 font-serif text-[26px] text-forest">{formatGHS(cycle.acceptanceFee)}</p>
          <p className="mt-2 text-sm text-muted">
            Pay this from your admission letter page once you accept the offer.
          </p>
        </Card>
      )}
    </div>
  );
}
