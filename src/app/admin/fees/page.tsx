import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { formatGHS } from "@/lib/money";
import { getIntFee, SETTING_KEYS } from "@/lib/settings";
import {
  addFeeItem, createFeeSchedule, deleteFeeItem, updateCycleFees, updateDocumentFees, updateHostelFee,
} from "@/lib/actions/system";
import { Flash } from "@/components/flash";

export const metadata = { title: "Fees" };

const ghs = (pesewas: number) => (pesewas / 100).toFixed(2);

export default async function FeesConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireDeveloperConsole();
  const { error, saved } = await searchParams;

  const [cycles, hostels, schedules, years, docTranscript, docAttestation, docVerification] = await Promise.all([
    db.admissionCycle.findMany({ orderBy: { opensAt: "desc" }, take: 5 }),
    db.hostel.findMany({ orderBy: { name: "asc" } }),
    db.feeSchedule.findMany({
      include: { items: true, academicYear: true },
      orderBy: [{ academicYear: { label: "desc" } }, { level: "asc" }],
    }),
    db.academicYear.findMany({ orderBy: { label: "desc" } }),
    getIntFee(SETTING_KEYS.DOC_FEE_TRANSCRIPT, 5000),
    getIntFee(SETTING_KEYS.DOC_FEE_ATTESTATION, 3000),
    getIntFee(SETTING_KEYS.DOC_FEE_VERIFICATION_LETTER, 2000),
  ]);

  const field = "rounded-md border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none";
  const saveBtn = "rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-deep";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Fees</h1>
      <p className="mt-1 text-sm text-ink-500">All amounts in GHS. Changes apply to bills generated after the change.</p>
      <Flash error={error} success={saved ? "Fees updated." : undefined} />

      {/* Admission cycle fees */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Admission cycle fees</h2>
        {cycles.map((c) => (
          <form key={c.id} action={updateCycleFees} className="mt-3 flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3">
            <input type="hidden" name="cycleId" value={c.id} />
            <div className="min-w-40 flex-1">
              <div className="text-sm font-medium">{c.name}</div>
              <div className="text-xs text-ink-500">{c.status}</div>
            </div>
            <label className="text-xs text-ink-600">
              Application fee
              <input name="applicationFeeGhs" type="number" step="0.01" min="0" defaultValue={ghs(c.applicationFee)} className={`${field} mt-1 block w-28`} />
            </label>
            <label className="text-xs text-ink-600">
              Acceptance fee
              <input name="acceptanceFeeGhs" type="number" step="0.01" min="0" defaultValue={ghs(c.acceptanceFee)} className={`${field} mt-1 block w-28`} />
            </label>
            <button type="submit" className={saveBtn}>Save</button>
          </form>
        ))}
        {cycles.length === 0 && <p className="mt-2 text-sm text-ink-500">No admission cycles yet.</p>}
      </section>

      {/* Document service fees */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Document service fees</h2>
        <form action={updateDocumentFees} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-600">
            Transcript (mailed copy)
            <input name="transcriptGhs" type="number" step="0.01" min="0" defaultValue={ghs(docTranscript)} className={`${field} mt-1 block w-28`} />
          </label>
          <label className="text-xs text-ink-600">
            Attestation
            <input name="attestationGhs" type="number" step="0.01" min="0" defaultValue={ghs(docAttestation)} className={`${field} mt-1 block w-28`} />
          </label>
          <label className="text-xs text-ink-600">
            Verification letter
            <input name="verificationGhs" type="number" step="0.01" min="0" defaultValue={ghs(docVerification)} className={`${field} mt-1 block w-28`} />
          </label>
          <button type="submit" className={saveBtn}>Save</button>
        </form>
      </section>

      {/* Hostel fees */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Hostel fees (per year)</h2>
        {hostels.map((h) => (
          <form key={h.id} action={updateHostelFee} className="mt-3 flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3">
            <input type="hidden" name="hostelId" value={h.id} />
            <div className="min-w-40 flex-1 text-sm font-medium">{h.name}</div>
            <input name="feeGhs" type="number" step="0.01" min="0" defaultValue={ghs(h.feePerYear)} className={`${field} w-28`} />
            <button type="submit" className={saveBtn}>Save</button>
          </form>
        ))}
        {hostels.length === 0 && <p className="mt-2 text-sm text-ink-500">No hostels yet.</p>}
      </section>

      {/* Tuition fee schedules */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Tuition fee schedules</h2>
        <p className="mt-1 text-xs text-ink-500">
          Per academic year and programme level. Semester bills are generated from the items below.
        </p>

        {schedules.map((s) => (
          <div key={s.id} className="mt-4 rounded-md border border-ink-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-ink-500">{s.academicYear.label} · {s.level}</div>
            </div>
            <table className="mt-2 w-full text-left text-sm">
              <tbody>
                {s.items.map((i) => (
                  <tr key={i.id} className="border-t border-ink-100">
                    <td className="py-1.5">{i.name}</td>
                    <td className="py-1.5 text-right font-mono">{formatGHS(i.amount)}</td>
                    <td className="w-14 py-1.5 text-right">
                      <form action={deleteFeeItem}>
                        <input type="hidden" name="itemId" value={i.id} />
                        <button type="submit" className="text-xs text-red-700 hover:underline">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-ink-300 font-semibold">
                  <td className="py-1.5">Total per semester</td>
                  <td className="py-1.5 text-right font-mono">{formatGHS(s.items.reduce((sum, i) => sum + i.amount, 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <form action={addFeeItem} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="scheduleId" value={s.id} />
              <input name="name" placeholder="Fee item (e.g. Tuition, ICT levy)" required className={`${field} flex-1`} />
              <input name="amountGhs" type="number" step="0.01" min="0" placeholder="GHS" required className={`${field} w-24`} />
              <button type="submit" className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
                Add item
              </button>
            </form>
          </div>
        ))}

        <form action={createFeeSchedule} className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-200 pt-4">
          <span className="text-sm font-medium text-ink-700">New schedule:</span>
          <select name="academicYearId" required className={field}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
          <select name="level" required className={field}>
            <option value="UNDERGRADUATE">Undergraduate</option>
            <option value="POSTGRADUATE">Postgraduate</option>
          </select>
          <input name="name" placeholder="Schedule name" required className={`${field} flex-1`} />
          <button type="submit" className={saveBtn}>Create</button>
        </form>
      </section>
    </div>
  );
}
