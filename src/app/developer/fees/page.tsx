import { db } from "@/lib/db";
import { requireFeesConsole } from "@/lib/rbac";
import { formatGHS, formatUSDEquivalent, parseUsdRate } from "@/lib/money";
import { getIntFee, getSetting, SETTING_KEYS } from "@/lib/settings";
import {
  addFeeItem, createFeeSchedule, deleteFeeItem, saveCurrencyRate,
  updateCycleFees, updateDocumentFees, updateHostelFee, updateLibraryFine,
  updateShortCourseFee,
} from "@/lib/actions/system";
import { Flash } from "@/components/flash";

export const metadata = { title: "Fees & Pricing" };

const ghs = (pesewas: number) => (pesewas / 100).toFixed(2);

const field = "rounded-md border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none";
const saveBtn = "rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-deep";

/** Paired GHS + USD inputs; the USD column only renders once a rate is set. */
function AmountInputs({
  ghsName, usdName, pesewas, rate,
}: {
  ghsName: string; usdName: string; pesewas: number; rate: number | null;
}) {
  return (
    <>
      <label className="text-xs text-ink-600">
        GHS
        {rate && <span className="ml-1 text-[11px] text-ink-400">≈ {formatUSDEquivalent(pesewas, rate)}</span>}
        <input name={ghsName} type="number" step="0.01" min="0" defaultValue={ghs(pesewas)} className={`${field} mt-1 block w-28`} />
      </label>
      {rate && (
        <label className="text-xs text-ink-600">
          or USD
          <input name={usdName} type="number" step="0.01" min="0" placeholder="$" className={`${field} mt-1 block w-24`} />
        </label>
      )}
    </>
  );
}

export default async function FeesConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  // Pricing is the developer's alone — system admins keep the rest of the
  // console but are bounced from this page.
  await requireFeesConsole();
  const { error, saved } = await searchParams;

  const [cycles, hostels, schedules, years, docTranscript, docAttestation, docVerification, libraryFine, rateRaw, shortCourses] =
    await Promise.all([
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
      getIntFee(SETTING_KEYS.LIBRARY_FINE_PER_DAY, 100),
      getSetting(SETTING_KEYS.USD_TO_GHS_RATE),
      db.shortCourse.findMany({ orderBy: { name: "asc" } }),
    ]);
  const rate = parseUsdRate(rateRaw);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Fees &amp; pricing</h1>
      <p className="mt-1 text-sm text-ink-500">
        Charged in GHS. Changes apply to bills generated after the change. This page is available to the
        developer account only.
      </p>
      <Flash error={error} success={saved ? "Pricing updated." : undefined} />

      {/* Currency multiplier */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Currency multiplier (USD → GHS)</h2>
        <p className="mt-1 text-xs text-ink-500">
          Paystack does not settle USD for Ghana, so fees are always charged in GHS. Set how many GHS one
          US dollar buys and every fee below can be entered in dollars — the GHS amount is computed at this
          rate when you save. Update it whenever the exchange rate moves.
        </p>
        <form action={saveCurrencyRate} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-600">
            1 USD =
            <input
              name="rate" type="number" step="0.0001" min="0.01"
              defaultValue={rate ?? undefined} placeholder="e.g. 15.50"
              className={`${field} mt-1 block w-32`}
            />
          </label>
          <span className="pb-2 text-xs text-ink-500">GHS</span>
          <button type="submit" className={saveBtn}>Save rate</button>
          {rate && (
            <button type="submit" name="clear" value="1" className="rounded-full border border-ink-300 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50">
              Clear (GHS-only pricing)
            </button>
          )}
        </form>
        {rate ? (
          <p className="mt-2 text-xs text-forest">
            Active: $1 = GHS {rate.toFixed(2)} — USD columns are enabled below, and each fee shows its
            dollar equivalent.
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink-500">No rate set — fees are entered in GHS only.</p>
        )}
      </section>

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
            <div className="flex items-end gap-2">
              <span className="pb-2 text-xs font-medium text-ink-600">Application</span>
              <AmountInputs ghsName="applicationFeeGhs" usdName="applicationFeeUsd" pesewas={c.applicationFee} rate={rate} />
            </div>
            <div className="flex items-end gap-2">
              <span className="pb-2 text-xs font-medium text-ink-600">Acceptance</span>
              <AmountInputs ghsName="acceptanceFeeGhs" usdName="acceptanceFeeUsd" pesewas={c.acceptanceFee} rate={rate} />
            </div>
            <button type="submit" className={saveBtn}>Save</button>
          </form>
        ))}
        {cycles.length === 0 && <p className="mt-2 text-sm text-ink-500">No admission cycles yet.</p>}
      </section>

      {/* Document service fees */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Document service fees</h2>
        <form action={updateDocumentFees} className="mt-3 flex flex-wrap items-end gap-4">
          <div className="flex items-end gap-2">
            <span className="pb-2 text-xs font-medium text-ink-600">Transcript</span>
            <AmountInputs ghsName="transcriptGhs" usdName="transcriptUsd" pesewas={docTranscript} rate={rate} />
          </div>
          <div className="flex items-end gap-2">
            <span className="pb-2 text-xs font-medium text-ink-600">Attestation</span>
            <AmountInputs ghsName="attestationGhs" usdName="attestationUsd" pesewas={docAttestation} rate={rate} />
          </div>
          <div className="flex items-end gap-2">
            <span className="pb-2 text-xs font-medium text-ink-600">Verification letter</span>
            <AmountInputs ghsName="verificationGhs" usdName="verificationUsd" pesewas={docVerification} rate={rate} />
          </div>
          <button type="submit" className={saveBtn}>Save</button>
        </form>
      </section>

      {/* Short course fees */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Short course fees (vocational intensives)</h2>
        <p className="mt-1 text-xs text-ink-500">
          A fee of GHS 0.00 means &ldquo;to be announced&rdquo; — public registration stays closed for
          that course until you set a price here.
        </p>
        {shortCourses.map((sc) => (
          <form key={sc.id} action={updateShortCourseFee} className="mt-3 flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3">
            <input type="hidden" name="shortCourseId" value={sc.id} />
            <div className="min-w-40 flex-1">
              <div className="text-sm font-medium">{sc.name}{!sc.active && <span className="ml-1.5 font-normal text-ink-400">(inactive)</span>}</div>
              <div className="text-xs text-ink-500">{sc.durationWeeks} weeks</div>
            </div>
            <AmountInputs ghsName="feeGhs" usdName="feeUsd" pesewas={sc.feePesewas} rate={rate} />
            <button type="submit" className={saveBtn}>Save</button>
          </form>
        ))}
        {shortCourses.length === 0 && <p className="mt-2 text-sm text-ink-500">No short courses yet.</p>}
      </section>

      {/* Library fine */}
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Library overdue fine (per day)</h2>
        <form action={updateLibraryFine} className="mt-3 flex flex-wrap items-end gap-3">
          <AmountInputs ghsName="fineGhs" usdName="fineUsd" pesewas={libraryFine} rate={rate} />
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
            <AmountInputs ghsName="feeGhs" usdName="feeUsd" pesewas={h.feePerYear} rate={rate} />
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
                    <td className="py-1.5 text-right font-mono">
                      {formatGHS(i.amount)}
                      {rate && <span className="ml-1 font-sans text-[11px] text-ink-400">≈ {formatUSDEquivalent(i.amount, rate)}</span>}
                    </td>
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
                  <td className="py-1.5 text-right font-mono">
                    {formatGHS(s.items.reduce((sum, i) => sum + i.amount, 0))}
                    {rate && (
                      <span className="ml-1 font-sans text-[11px] font-normal text-ink-400">
                        ≈ {formatUSDEquivalent(s.items.reduce((sum, i) => sum + i.amount, 0), rate)}
                      </span>
                    )}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
            <form action={addFeeItem} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="scheduleId" value={s.id} />
              <input name="name" placeholder="Fee item (e.g. Tuition, ICT levy)" required className={`${field} flex-1`} />
              <input name="amountGhs" type="number" step="0.01" min="0" placeholder="GHS" className={`${field} w-24`} />
              {rate && <input name="amountUsd" type="number" step="0.01" min="0" placeholder="or USD" className={`${field} w-24`} />}
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
