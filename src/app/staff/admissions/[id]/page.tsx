import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_COLOR, APPLICATION_STATUS_LABEL } from "@/lib/status-labels";
import {
  approveAndIssueOffer, recordRecommendation, requestInfo, runDocumentExtractionAction,
  runPrescreenAction, startReview,
} from "@/lib/actions/admissions";
import { Flash } from "@/components/flash";

export const metadata = { title: "Review Application" };

const KIND_LABEL: Record<string, string> = {
  RESULTS_SLIP: "Results slip", CERTIFICATE: "Certificate", TRANSCRIPT: "Transcript",
  PHOTO: "Passport photo", ID_DOCUMENT: "ID document", OTHER: "Other",
};

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePortal("staff");
  const { id } = await params;
  const { error } = await searchParams;

  const app = await db.application.findUnique({
    where: { id },
    include: {
      user: true,
      choices: { include: { programme: true }, orderBy: { rank: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      offer: true,
    },
  });
  if (!app) notFound();

  const isOfficer = hasRole(user, ROLES.ADMISSIONS_OFFICER, ROLES.SYSTEM_ADMIN);
  const isRegistrar = hasRole(user, ROLES.REGISTRAR, ROLES.SYSTEM_ADMIN);
  const results = (app.results as { subject: string; grade: string }[] | null) ?? [];
  const prescreen = app.aiPrescreen as { requirementsMet: boolean; summary: string; flags: string[] } | null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/staff/admissions" className="text-sm text-ink-500 hover:underline">← Back to queue</Link>
      <Flash error={error} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {[app.firstName, app.surname].filter(Boolean).join(" ") || app.user.name}
          </h1>
          <p className="text-sm text-ink-500 font-mono">{app.refNo} · {app.user.email}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${APPLICATION_STATUS_COLOR[app.status]}`}>
          {APPLICATION_STATUS_LABEL[app.status]}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Personal + qualification */}
          <section className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Applicant details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><dt className="text-ink-500">Gender</dt><dd>{app.gender ?? "—"}</dd></div>
              <div><dt className="text-ink-500">Date of birth</dt><dd>{app.dateOfBirth?.toLocaleDateString() ?? "—"}</dd></div>
              <div><dt className="text-ink-500">Nationality</dt><dd>{app.nationality ?? "—"}</dd></div>
              <div><dt className="text-ink-500">Phone</dt><dd>{app.phone ?? "—"}</dd></div>
              <div><dt className="text-ink-500">Address</dt><dd>{app.address ?? "—"}</dd></div>
              <div><dt className="text-ink-500">Emergency contact</dt><dd>{app.emergencyName ? `${app.emergencyName} (${app.emergencyPhone ?? "no phone"})` : "—"}</dd></div>
              <div><dt className="text-ink-500">Qualification type</dt><dd>{app.qualificationType ?? "—"}</dd></div>
              <div><dt className="text-ink-500">Exam index no</dt><dd>{app.examIndexNo ?? "—"}</dd></div>
              <div><dt className="text-ink-500">Exam year</dt><dd>{app.examYear ?? "—"}</dd></div>
              <div><dt className="text-ink-500">Submitted</dt><dd>{app.submittedAt?.toLocaleString() ?? "—"}</dd></div>
            </dl>

            <h3 className="mt-4 text-sm font-semibold text-ink-700">Programme choices</h3>
            <ol className="mt-1 list-decimal pl-5 text-sm">
              {app.choices.map((c) => <li key={c.id}>{c.programme.name}</li>)}
            </ol>

            <h3 className="mt-4 text-sm font-semibold text-ink-700">Results</h3>
            {results.length === 0 ? (
              <p className="text-sm text-ink-500">No results entered.</p>
            ) : (
              <table className="mt-1 w-full text-left text-sm">
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-ink-100"><td className="py-1">{r.subject}</td><td className="py-1 font-mono">{r.grade}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Documents */}
          <section className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Documents</h2>
            {app.documents.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">No documents uploaded.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {app.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm">
                    <span>{KIND_LABEL[d.kind]} — {d.fileName}</span>
                    <span className="flex items-center gap-3">
                      <a
                        href={`/api/files/${d.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-800 hover:underline"
                      >
                        Open
                      </a>
                      {isOfficer && !d.extracted && (d.kind === "RESULTS_SLIP" || d.kind === "CERTIFICATE") && (
                        <form action={runDocumentExtractionAction}>
                          <input type="hidden" name="documentId" value={d.id} />
                          <button type="submit" className="text-xs text-brand-800 hover:underline">Run AI extraction</button>
                        </form>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AI prescreen */}
          <section className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-800">AI eligibility pre-screen</h2>
              {isOfficer && (
                <form action={runPrescreenAction}>
                  <input type="hidden" name="applicationId" value={app.id} />
                  <button type="submit" className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
                    {prescreen ? "Re-run pre-screen" : "Run pre-screen"}
                  </button>
                </form>
              )}
            </div>
            {!prescreen ? (
              <p className="mt-2 text-sm text-ink-500">Not yet run.</p>
            ) : (
              <div className="mt-3 rounded-md bg-ink-50 p-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${prescreen.requirementsMet ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}`}>
                  {prescreen.requirementsMet ? "Requirements appear met" : "Requirements may not be met"}
                </span>
                <p className="mt-2 text-ink-700">{prescreen.summary}</p>
                {prescreen.flags.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-amber-800">
                    {prescreen.flags.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
                <p className="mt-2 text-xs italic text-ink-500">
                  Advisory only — the admissions officer and Registrar make the actual decision.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Action panel */}
        <div className="space-y-4">
          {app.status === "SUBMITTED" && isOfficer && (
            <form action={startReview} className="rounded-2xl border border-line bg-paper p-4">
              <input type="hidden" name="applicationId" value={app.id} />
              <button type="submit" className="w-full rounded-full bg-forest px-3 py-2 text-sm font-medium text-white hover:bg-forest-deep">
                Start review
              </button>
            </form>
          )}

          {(app.status === "UNDER_REVIEW" || app.status === "INFO_REQUESTED") && isOfficer && (
            <>
              <form action={requestInfo} className="rounded-2xl border border-line bg-paper p-4">
                <input type="hidden" name="applicationId" value={app.id} />
                <h3 className="text-sm font-semibold text-ink-700">Request more information</h3>
                <textarea name="note" rows={2} required className="mt-2 w-full rounded-md border border-ink-300 p-2 text-sm" placeholder="What's missing?" />
                <button type="submit" className="mt-2 w-full rounded-md border border-ink-300 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
                  Send request
                </button>
              </form>

              <form action={recordRecommendation} className="rounded-2xl border border-line bg-paper p-4">
                <input type="hidden" name="applicationId" value={app.id} />
                <h3 className="text-sm font-semibold text-ink-700">Record recommendation</h3>
                <select name="recommendation" required className="mt-2 w-full rounded-md border border-ink-300 px-2 py-2 text-sm">
                  <option value="OFFER_FIRST_CHOICE">Offer first choice</option>
                  <option value="OFFER_ALTERNATIVE">Offer alternative programme</option>
                  <option value="WAITLIST">Waitlist</option>
                  <option value="REJECT">Reject</option>
                </select>
                <textarea name="note" rows={2} className="mt-2 w-full rounded-md border border-ink-300 p-2 text-sm" placeholder="Note (optional)" />
                <button type="submit" className="mt-2 w-full rounded-full bg-forest px-3 py-2 text-sm font-medium text-white hover:bg-forest-deep">
                  Submit recommendation
                </button>
              </form>
            </>
          )}

          {app.status === "RECOMMENDED" && (
            <div className="rounded-2xl border border-line bg-paper p-4">
              <h3 className="text-sm font-semibold text-ink-700">Officer recommendation</h3>
              <p className="mt-1 text-sm">{app.recommendation?.replaceAll("_", " ")}</p>
              {app.decisionNote && <p className="mt-1 text-xs text-ink-500">{app.decisionNote}</p>}
              {isRegistrar ? (
                <form action={approveAndIssueOffer} className="mt-3">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <button
                    type="submit"
                    className={`w-full rounded-md px-3 py-2 text-sm font-medium text-white ${
                      app.recommendation === "REJECT"
                        ? "bg-red-700 hover:bg-red-600"
                        : app.recommendation === "WAITLIST"
                          ? "bg-amber-600 hover:bg-amber-500"
                          : "bg-brand-800 hover:bg-forest-deep"
                    }`}
                  >
                    {app.recommendation === "REJECT"
                      ? "Confirm rejection"
                      : app.recommendation === "WAITLIST"
                        ? "Place on waitlist"
                        : "Approve & issue offer"}
                  </button>
                </form>
              ) : (
                <p className="mt-3 text-xs text-ink-500">Awaiting Registrar approval — a second, independent sign-off before any decision takes effect.</p>
              )}
            </div>
          )}

          {app.status === "WAITLISTED" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">On the waitlist</h3>
              <p className="mt-1 text-xs text-amber-800">
                If a place opens up, the Registrar can issue an offer for the applicant&apos;s first choice.
              </p>
              {isRegistrar && (
                <form action={approveAndIssueOffer} className="mt-3">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <button type="submit" className="w-full rounded-full bg-forest px-3 py-2 text-sm font-medium text-white hover:bg-forest-deep">
                    Issue offer now
                  </button>
                </form>
              )}
            </div>
          )}

          {app.offer && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm">
              <div className="font-semibold text-brand-900">Offer issued</div>
              <div className="mt-1 font-mono text-xs">{app.offer.letterCode}</div>
              <Link href={`/verify/${app.offer.letterCode}`} className="mt-2 inline-block text-xs text-brand-800 underline">
                Verify letter →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
