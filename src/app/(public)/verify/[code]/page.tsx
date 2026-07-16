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
    <div className="scr mx-auto max-w-[520px] px-7 py-16 text-center">
      <div className="mb-3 eyebrow">Document verification</div>
      <h1 className="mb-2 font-serif text-[34px] font-normal">Verify a document</h1>
      <p className="text-sm text-muted">
        Code: <span className="font-mono text-ink">{code}</span>
      </p>

      {!doc ? (
        <div className="mt-8 rounded-[18px] border-2 border-[#e3b5ad] bg-[#faece9] p-6">
          <div className="font-serif text-[22px] text-[#b23a2e]">Not verified</div>
          <p className="mt-2 text-sm leading-[1.55] text-[#8a463c]">
            No genuine document matches this code. Do not trust or act on a document carrying this
            code — report it to the Center.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-[18px] border-2 border-forest bg-[#eaf0ea] p-7 text-left">
          <div className="text-center font-serif text-[22px] text-forest">✓ Genuine document</div>
          <dl className="mt-5 space-y-[10px] text-sm">
            <Row k="Type" v={TYPE_LABEL[doc.type] ?? doc.type} />
            <Row k="Title" v={doc.title} />
            <Row k="Issued" v={doc.createdAt.toLocaleDateString()} />
            {Object.entries(doc.payload as Record<string, string>)
              .filter(([k]) => !["issuedAt"].includes(k))
              .map(([k, v]) => (
                <Row key={k} k={k.replace(/([A-Z])/g, " $1").trim()} v={String(v)} cap />
              ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, cap }: { k: string; v: string; cap?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-[10px] last:border-b-0 last:pb-0">
      <dt className={`text-muted ${cap ? "capitalize" : ""}`}>{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}
