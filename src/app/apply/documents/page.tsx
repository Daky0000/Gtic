import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  applyExtractedResults, getOrCreateDraftApplication, runDocumentExtractionAction, uploadApplicationDocument,
} from "@/lib/actions/admissions";

export const metadata = { title: "Documents" };

const KIND_LABEL: Record<string, string> = {
  RESULTS_SLIP: "Results slip",
  CERTIFICATE: "Certificate",
  TRANSCRIPT: "Transcript",
  PHOTO: "Passport photo",
  ID_DOCUMENT: "ID document",
  OTHER: "Other",
};

export default async function DocumentsPage() {
  const user = await requirePortal("apply");
  const app = await getOrCreateDraftApplication(user.id);
  if (!app) redirect("/apply");

  const documents = await db.applicationDocument.findMany({
    where: { applicationId: app.id },
    orderBy: { uploadedAt: "desc" },
  });
  const editable = app.status === "DRAFT" || app.status === "INFO_REQUESTED";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Documents</h1>
      <p className="mt-1 text-sm text-ink-500">
        Upload your results slip, certificates and photo. The AI assistant can read your results slip and
        fill in your grades automatically — you always confirm what it found before it&apos;s applied.
      </p>

      {editable && (
        <form
          action={uploadApplicationDocument}
          encType="multipart/form-data"
          className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-ink-300/60 bg-white p-5"
        >
          <input type="hidden" name="applicationId" value={app.id} />
          <div>
            <label className="block text-sm font-medium text-ink-700">Document type</label>
            <select name="kind" required className="mt-1 rounded-md border border-ink-300 px-3 py-2 text-sm">
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-ink-700">File</label>
            <input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png" className="mt-1 text-sm" />
          </div>
          <button type="submit" className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Upload
          </button>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {documents.length === 0 && <p className="text-sm text-ink-500">No documents uploaded yet.</p>}
        {documents.map((doc) => {
          const extracted = doc.extracted as
            | { subjects: { subject: string; grade: string }[]; notes: string | null }
            | null;
          return (
            <div key={doc.id} className="rounded-lg border border-ink-300/60 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{KIND_LABEL[doc.kind]}</div>
                  <div className="text-xs text-ink-500">{doc.fileName} · {(doc.size / 1024).toFixed(0)} KB</div>
                </div>
                {(doc.kind === "RESULTS_SLIP" || doc.kind === "CERTIFICATE") && editable && (
                  <form action={runDocumentExtractionAction}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <button type="submit" className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
                      {extracted ? "Re-run AI extraction" : "Run AI extraction"}
                    </button>
                  </form>
                )}
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
                      <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
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
