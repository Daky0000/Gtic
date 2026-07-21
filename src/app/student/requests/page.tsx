import Link from "next/link";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { payDocumentFee, requestDocument } from "@/lib/actions/comms";
import { Flash } from "@/components/flash";

export const metadata = { title: "Document Requests" };

const TYPE_LABEL: Record<string, string> = {
  TRANSCRIPT: "Official transcript (mailed/collected copy)",
  ATTESTATION: "Attestation letter",
  VERIFICATION_LETTER: "Verification letter",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  QUEUED: "Queued for processing",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

export default async function DocumentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  const { error, paid } = await searchParams;
  const user = await requirePortal("student");

  const requests = await db.documentRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const invoices = await db.invoice.findMany({ where: { userId: user.id, kind: "DOCUMENT" } });
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const issuedDocs = await db.issuedDocument.findMany({ where: { userId: user.id } });
  const issuedById = new Map(issuedDocs.map((d) => [d.id, d]));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Document requests</h1>
      <Flash error={error} success={paid ? "Payment received — your request has been queued." : undefined} />
      <p className="mt-1 text-sm text-ink-500">
        For a free, instantly verifiable transcript, use the <Link href="/student/transcript" className="text-brand-800 underline">Transcript</Link> page.
        Use this for a paid, officially processed copy or attestation.
      </p>

      <form action={requestDocument} className="mt-4 space-y-2 rounded-2xl border border-line bg-paper p-4">
        <select name="type" className="w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm">
          {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input name="note" placeholder="Note (e.g. addressed to which institution)" className="w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
        <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
          Request
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {requests.map((r) => {
          const invoice = r.invoiceId ? invoiceById.get(r.invoiceId) : undefined;
          const issued = r.issuedDocId ? issuedById.get(r.issuedDocId) : undefined;
          return (
            <div key={r.id} className="rounded-2xl border border-line bg-paper p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{TYPE_LABEL[r.type]}</span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">{STATUS_LABEL[r.status]}</span>
              </div>
              {invoice && r.status === "PENDING_PAYMENT" && (
                <form action={payDocumentFee} className="mt-2">
                  <input type="hidden" name="requestId" value={r.id} />
                  <button type="submit" className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep">
                    Pay {formatGHS(invoice.total - invoice.paid)}
                  </button>
                </form>
              )}
              {issued && (
                <Link href={`/verify/${issued.code}`} className="mt-2 inline-block text-xs text-brand-800 underline">
                  View / verify document →
                </Link>
              )}
            </div>
          );
        })}
        {requests.length === 0 && <p className="text-sm text-ink-500">No requests yet.</p>}
      </div>
    </div>
  );
}
