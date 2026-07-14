import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { processDocumentRequest, rejectDocumentRequest } from "@/lib/actions/comms";

export const metadata = { title: "Document Requests" };

const TYPE_LABEL: Record<string, string> = {
  TRANSCRIPT: "Official transcript", ATTESTATION: "Attestation letter", VERIFICATION_LETTER: "Verification letter",
};

export default async function StaffDocumentsPage() {
  await requirePortal("staff");

  const requests = await db.documentRequest.findMany({
    where: { status: { in: ["QUEUED", "PROCESSING"] } },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Document requests</h1>
      <p className="mt-1 text-sm text-ink-500">Paid requests awaiting fulfilment.</p>

      <div className="mt-6 space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-ink-300/60 bg-white p-4 text-sm">
            <div>
              <div className="font-medium">{r.user.name} — {TYPE_LABEL[r.type]}</div>
              {r.note && <div className="text-xs text-ink-500">{r.note}</div>}
            </div>
            <div className="flex gap-2">
              <form action={processDocumentRequest}><input type="hidden" name="requestId" value={r.id} /><button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">Complete &amp; issue</button></form>
              <form action={rejectDocumentRequest}><input type="hidden" name="requestId" value={r.id} /><button type="submit" className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100">Reject</button></form>
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="text-sm text-ink-500">Nothing pending.</p>}
      </div>
    </div>
  );
}
