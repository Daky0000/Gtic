import { db } from "@/lib/db";

export const metadata = { title: "Verify a Document" };

const TYPE_LABEL: Record<string, string> = {
  ADMISSION_LETTER: "Admission Letter",
  RECEIPT: "Payment Receipt",
  TRANSCRIPT: "Transcript",
  PROOF_OF_REGISTRATION: "Proof of Registration",
  ALLOCATION_SLIP: "Hostel Allocation Slip",
  ATTESTATION: "Attestation",
};

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const doc = await db.issuedDocument.findUnique({ where: { code } });

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Document Verification</h1>
      <p className="mt-1 text-sm text-ink-500">Code: <span className="font-mono">{code}</span></p>

      {!doc ? (
        <div className="mt-8 rounded-lg border-2 border-red-300 bg-red-50 p-6">
          <div className="text-lg font-bold text-red-800">Not verified</div>
          <p className="mt-2 text-sm text-red-700">
            No genuine document matches this code. Do not trust or act on a document carrying this code —
            report it to the university.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-lg border-2 border-brand-600 bg-brand-50 p-6 text-left">
          <div className="text-center text-lg font-bold text-brand-800">✓ Genuine document</div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">Type</dt><dd className="font-medium">{TYPE_LABEL[doc.type] ?? doc.type}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Title</dt><dd className="font-medium">{doc.title}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Issued</dt><dd className="font-medium">{doc.createdAt.toLocaleDateString()}</dd></div>
            {Object.entries(doc.payload as Record<string, string>)
              .filter(([k]) => !["issuedAt"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ink-500 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </div>
  );
}
