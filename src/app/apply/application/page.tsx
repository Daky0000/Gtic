import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getOrCreateDraftApplication, saveApplicationDetails, submitApplication } from "@/lib/actions/admissions";
import { Flash } from "@/components/flash";

export const metadata = { title: "My Application" };

const RESULT_ROWS = 9;

export default async function ApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; paid?: string }>;
}) {
  const user = await requirePortal("apply");
  const { error, saved, paid } = await searchParams;
  const app = await getOrCreateDraftApplication(user.id);
  if (!app) redirect("/apply");

  const editable = app.status === "DRAFT" || app.status === "INFO_REQUESTED";
  const schools = await db.school.findMany({
    orderBy: { name: "asc" },
    include: { departments: { include: { programmes: { orderBy: { name: "asc" } } } } },
  });
  const choices = await db.applicationChoice.findMany({
    where: { applicationId: app.id },
    orderBy: { rank: "asc" },
  });
  const results = (app.results as { subject: string; grade: string }[] | null) ?? [];

  const field = "mt-1.5 w-full rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-forest disabled:opacity-70";
  const label = "block text-[13px] text-muted";

  return (
    <div className="scr mx-auto max-w-3xl">
      <h1 className="font-serif text-[30px] font-normal leading-[1.1]">
        My <em className="text-forest">application.</em>
      </h1>
      <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
        Reference {app.refNo}
      </p>
      <Flash
        error={error}
        success={
          saved
            ? "Your application details were saved."
            : paid
              ? "Voucher payment confirmed — welcome! Fill in your application form below."
              : undefined
        }
      />
      {!editable && (
        <p className="mt-3 rounded-[11px] bg-line-soft p-3 text-sm text-ink">
          This application has been submitted and can no longer be edited here.
        </p>
      )}

      <form action={saveApplicationDetails} className="mt-6 space-y-8">
        <input type="hidden" name="applicationId" value={app.id} />

        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Personal details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Surname</label>
              <input name="surname" defaultValue={app.surname ?? ""} disabled={!editable} className={field} />
            </div>
            <div>
              <label className={label}>First name</label>
              <input name="firstName" defaultValue={app.firstName ?? ""} disabled={!editable} className={field} />
            </div>
            <div>
              <label className={label}>Other names</label>
              <input name="otherNames" defaultValue={app.otherNames ?? ""} disabled={!editable} className={field} />
            </div>
            <div>
              <label className={label}>Date of birth</label>
              <input
                type="date" name="dateOfBirth"
                defaultValue={app.dateOfBirth ? app.dateOfBirth.toISOString().slice(0, 10) : ""}
                disabled={!editable} className={field}
              />
            </div>
            <div>
              <label className={label}>Gender</label>
              <select name="gender" defaultValue={app.gender ?? ""} disabled={!editable} className={field}>
                <option value="">Select…</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
            <div>
              <label className={label}>Nationality</label>
              <input name="nationality" defaultValue={app.nationality ?? "Ghanaian"} disabled={!editable} className={field} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input name="phone" defaultValue={app.phone ?? ""} disabled={!editable} className={field} />
            </div>
            <div>
              <label className={label}>Address</label>
              <input name="address" defaultValue={app.address ?? ""} disabled={!editable} className={field} />
            </div>
            <div>
              <label className={label}>Emergency contact name</label>
              <input name="emergencyName" defaultValue={app.emergencyName ?? ""} disabled={!editable} className={field} />
            </div>
            <div>
              <label className={label}>Emergency contact phone</label>
              <input name="emergencyPhone" defaultValue={app.emergencyPhone ?? ""} disabled={!editable} className={field} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Qualification</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label}>Qualification type</label>
              <select name="qualificationType" defaultValue={app.qualificationType ?? "WASSCE"} disabled={!editable} className={field}>
                <option value="WASSCE">WASSCE</option>
                <option value="MATURE">Mature entry</option>
                <option value="INTERNATIONAL">International</option>
                <option value="POSTGRADUATE">Postgraduate</option>
              </select>
            </div>
            <div>
              <label className={label}>Examination index number</label>
              <input name="examIndexNo" defaultValue={app.examIndexNo ?? ""} disabled={!editable} className={field} />
            </div>
            <div>
              <label className={label}>Examination year</label>
              <input name="examYear" defaultValue={app.examYear ?? ""} disabled={!editable} className={field} />
            </div>
          </div>

          <h3 className="mt-5 text-sm font-semibold text-ink-700">Results</h3>
          <p className="text-xs text-ink-500">
            Enter each subject and grade, or upload your results slip under Documents and let the AI assistant
            fill this in for you to confirm.
          </p>
          <div className="mt-3 space-y-2">
            {Array.from({ length: RESULT_ROWS }).map((_, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input
                  name={`subject_${i}`} placeholder="Subject" disabled={!editable}
                  defaultValue={results[i]?.subject ?? ""} className={field}
                />
                <input
                  name={`grade_${i}`} placeholder="Grade" disabled={!editable}
                  defaultValue={results[i]?.grade ?? ""} className={field}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold text-brand-800">Programme choices</h2>
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((rank) => (
              <div key={rank}>
                <label className={label}>Choice {rank}</label>
                <select
                  name={`choice${rank}`}
                  defaultValue={choices.find((c) => c.rank === rank)?.programmeId ?? ""}
                  disabled={!editable}
                  className={field}
                >
                  <option value="">Select a programme…</option>
                  {schools.map((s) => (
                    <optgroup key={s.id} label={s.name}>
                      {s.departments.flatMap((d) =>
                        d.programmes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))
                      )}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        {editable && (
          <button
            type="submit"
            className="rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep"
          >
            Save
          </button>
        )}
      </form>

      {editable && (
        <form action={submitApplication} className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-5">
          <input type="hidden" name="applicationId" value={app.id} />
          <h2 className="font-semibold text-brand-900">Ready to submit?</h2>
          <p className="mt-1 text-sm text-brand-800">
            Make sure you have saved your details, uploaded your documents, and paid the application fee
            (or redeemed a voucher) before submitting. Once submitted you cannot make further changes unless
            the admissions office requests more information.
          </p>
          <button
            type="submit"
            className="mt-3 rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep"
          >
            Submit application
          </button>
        </form>
      )}
    </div>
  );
}
