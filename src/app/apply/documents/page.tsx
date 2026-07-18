import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  applyExtractedResults, deleteApplicationDocument, getOrCreateDraftApplication,
  runDocumentExtractionAction, uploadApplicationDocument,
} from "@/lib/actions/admissions";
import { Flash } from "@/components/flash";

export const metadata = { title: "Documents" };

const KIND_LABEL: Record<string, string> = {
  RESULTS_SLIP: "Results slip",
  CERTIFICATE: "Certificate",
  TRANSCRIPT: "Transcript",
  PHOTO: "Passport photo",
  ID_DOCUMENT: "ID document",
  OTHER: "Other",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePortal("apply");
  const { error } = await searchParams;
  const app = await getOrCreateDraftApplication(user.id);
  if (!app) redirect("/apply");

  const documents = await db.applicationDocument.findMany({
    where: { applicationId: app.id },
    orderBy: { uploadedAt: "desc" },
  });
  const editable = app.status === "DRAFT" || app.status === "INFO_REQUESTED";

  return (
    <div className="scr mx-auto max-w-3xl">
      <h1 className="font-serif text-[30px] font-normal leading-[1.1]">
        Your <em className="text-forest">documents.</em>
      </h1>
      <p className="mt-1.5 text-sm leading-[1.6] text-muted">
        Upload your results slip, certificates and photo. The AI assistant can read your results slip and
        fill in your grades automatically — you always confirm what it found before it&apos;s applied.
      </p>
      <Flash error={error} />

      {editable && (
        <form
          action={uploadApplicationDocument}
          encType="multipart/form-data"
          className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-paper p-5"
        >
          <input type="hidden" name="applicationId" value={app.id} />
          <div>
            <label className="block text-[13px] text-muted">Document type</label>
            <select name="kind" required className="mt-1.5 rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-forest">
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[13px] text-muted">File (PDF, PNG, JPG or WEBP)</label>
            <input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp" className="mt-1.5 text-sm" />
          </div>
          <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
            Upload
          </button>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {documents.length === 0 && (
          <p className="text-sm text-muted">
            No documents uploaded yet — start with your results slip or certificate.
          </p>
        )}
        {documents.map((doc) => {
          const extracted = doc.extracted as
            | { subjects: { subject: string; grade: string }[]; notes: string | null }
            | null;
          return (
            <div key={doc.id} className="rounded-2xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-ink">{KIND_LABEL[doc.kind]}</div>
                  <div className="text-xs text-faint">{doc.fileName} · {(doc.size / 1024).toFixed(0)} KB</div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/files/${doc.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
                  >
                    View
                  </a>
                  {(doc.kind === "RESULTS_SLIP" || doc.kind === "CERTIFICATE") && editable && (
                    <form action={runDocumentExtractionAction}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <button type="submit" className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
                        {extracted ? "Re-run AI extraction" : "Run AI extraction"}
                      </button>
                    </form>
                  )}
                  {editable && (
                    <form action={deleteApplicationDocument}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <button type="submit" className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {extracted && (
                <div className="mt-3 rounded-md bg-ink-50 p-3 text-sm">
                  <div className="font-medium text-ink-700">AI-extracted results (please confirm):</div>
                  <table className="mt-2 w-full text-left text-xs">
                    <tbody>
                      {extracted.subjects.map((s, i) => (
                        <tr key={i} className="border-b border-ink-200">
                          <td className="py-1 pr-2">{s.subject}</td>
                          <td className="py-1 font-mono">{s.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {extracted.notes && <p className="mt-2 text-xs italic text-ink-500">{extracted.notes}</p>}
                  {editable && (
                    <form action={applyExtractedResults} className="mt-3">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <button type="submit" className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep">
                        Apply these results to my application
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
