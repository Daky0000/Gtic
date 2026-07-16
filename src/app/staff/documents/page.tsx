import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { processDocumentRequest, rejectDocumentRequest } from "@/lib/actions/comms";
import { Flash } from "@/components/flash";

export const metadata = { title: "Document Requests" };

const TYPE_LABEL: Record<string, string> = {
  TRANSCRIPT: "Official transcript", ATTESTATION: "Attestation letter", VERIFICATION_LETTER: "Verification letter",
};

export default async function StaffDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  await requirePortal("staff");

  const requests = await db.documentRequest.findMany({
    where: { status: { in: ["QUEUED", "PROCESSING"] } },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Document requests</h1>
      <Flash error={error} />
      <p className="mt-1 text-sm text-ink-500">Paid requests awaiting fulfilment.</p>

      <div className="mt-6 space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-2xl border border-line bg-paper p-4 text-sm">
            <div>
              <div className="font-medium">{r.user.name} — {TYPE_LABEL[r.type]}</div>
              {r.note && <div className="text-xs text-ink-500">{r.note}</div>}
            </div>
            <div className="flex gap-2">
              <form action={processDocumentRequest}><input type="hidden" name="requestId" value={r.id} /><button type="submit" className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep">Complete &amp; issue</button></form>
              <form action={rejectDocumentRequest}><input type="hidden" name="requestId" value={r.id} /><button type="submit" className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100">Reject</button></form>
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="text-sm text-ink-500">Nothing pending.</p>}
      </div>
    </div>
  );
}
