"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

export type BatchOption = { id: string; label: string; startDate: string; endDate: string };

const inputCls =
  "mt-1.5 w-full rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-forest disabled:opacity-70";
const errorCls = "border-[#b23a2e] bg-[#faece9]";
const labelCls = "block text-[13px] text-muted";

const STEPS = [
  "Personal details",
  "Training details",
  "Education & experience",
  "Medical & safety",
  "Referral & declaration",
  "Review & submit",
];

const TOOL_OPTIONS = [
  { value: "MULTIMETER", label: "Multimeter" },
  { value: "SCREWDRIVER_SET", label: "Screwdriver set" },
  { value: "NONE", label: "None" },
];

function fieldFilled(form: HTMLFormElement, name: string): boolean {
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | RadioNodeList | null;
  if (!el) return true;
  if (el instanceof RadioNodeList) return !!el.value;
  if ("type" in el && el.type === "checkbox") return (el as HTMLInputElement).checked;
  return !!("value" in el ? el.value.trim() : "");
}

export function ShortCourseRegistrationWizard({
  reg,
  batches,
  documentsSection,
  editable,
  initialStep,
  saveAction,
  returnTo,
}: {
  saveAction: (formData: FormData) => Promise<void>;
  reg: {
    id: string;
    fullName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    idNumber: string | null;
    phone: string | null;
    email: string | null;
    currentAddress: string | null;
    homeRegion: string | null;
    emergencyName: string | null;
    emergencyRelationship: string | null;
    emergencyPhone: string | null;
    emergencyEmail: string | null;
    batchId: string | null;
    fullDuration: boolean | null;
    partialDurationNote: string | null;
    accommodation: string | null;
    tshirtSize: string | null;
    educationLevel: string | null;
    educationOther: string | null;
    experienceLevel: string | null;
    experienceNote: string | null;
    toolsOwned: string[];
    medicalConditions: string | null;
    bloodGroup: string | null;
    referralSource: string | null;
    referralOther: string | null;
    sponsorship: string | null;
    sponsorName: string | null;
    declarationName: string | null;
    declarationAccepted: boolean;
  };
  batches: BatchOption[];
  documentsSection: ReactNode;
  editable: boolean;
  initialStep: number;
  /** Threaded into the form so submissions land back on whichever page
   * rendered this wizard (/short-courses/register/[id] or /apply/application). */
  returnTo?: string;
}) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), STEPS.length - 1));
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [tools, setTools] = useState<Set<string>>(new Set(reg.toolsOwned));
  const [fullDuration, setFullDuration] = useState(reg.fullDuration === false ? "no" : reg.fullDuration === true ? "yes" : "");
  const [hasMedicalCondition, setHasMedicalCondition] = useState(!!reg.medicalConditions);

  const requiredByStep: Record<number, string[]> = useMemo(
    () => ({
      0: ["fullName", "gender", "dateOfBirth", "idNumber", "phone", "email", "currentAddress", "homeRegion", "emergencyName", "emergencyPhone"],
      1: ["batchId", "fullDuration", "accommodation", "tshirtSize"],
      2: ["educationLevel"],
      3: [],
      4: ["referralSource", "declarationName", "declarationAccepted"],
      5: [],
    }),
    []
  );

  function validateStep(current: number): boolean {
    if (!editable) return true;
    const form = document.getElementById("short-course-form") as HTMLFormElement | null;
    if (!form) return true;
    const missing = new Set<string>();
    for (const name of requiredByStep[current] ?? []) {
      if (!fieldFilled(form, name)) missing.add(name);
    }
    setInvalid(missing);
    if (missing.size > 0) {
      const first = form.elements.namedItem([...missing][0]) as HTMLElement | RadioNodeList | null;
      const el = first instanceof RadioNodeList ? (first[0] as HTMLElement) : first;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return missing.size === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!editable) return;
    const form = e.currentTarget;
    const missing = new Set<string>();
    let firstBadStep = -1;
    for (const [stepIdx, names] of Object.entries(requiredByStep)) {
      for (const name of names) {
        if (!fieldFilled(form, name)) {
          missing.add(name);
          if (firstBadStep === -1) firstBadStep = Number(stepIdx);
        }
      }
    }
    if (missing.size > 0) {
      e.preventDefault();
      setInvalid(missing);
      if (firstBadStep >= 0) setStep(firstBadStep);
    }
  }

  const cls = (name: string) => `${inputCls} ${invalid.has(name) ? errorCls : ""}`;
  const req = <span className="text-[#b23a2e]">*</span>;

  return (
    <div className="mt-6">
      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => (i < step ? setStep(i) : i === step ? null : validateStep(step) && setStep(i))}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                i === step ? "bg-forest text-white" : i < step ? "bg-[#eaf0ea] text-forest" : "bg-line-soft text-faint"
              }`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      {invalid.size > 0 && (
        <p role="alert" className="mb-4 rounded-[11px] bg-[#faece9] p-3 text-sm text-[#b23a2e]">
          Please fill in the highlighted required field{invalid.size > 1 ? "s" : ""} before continuing.
        </p>
      )}

      <form id="short-course-form" action={saveAction} onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="registrationId" value={reg.id} />
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        {/* STEP 1 — Personal details */}
        <section className={step === 0 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Personal details</h2>
            <p className="mt-1 text-xs text-ink-500">As on your Ghana Card or passport.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Full name {req}</label>
                <input name="fullName" defaultValue={reg.fullName ?? ""} disabled={!editable} className={cls("fullName")} />
              </div>
              <div>
                <label className={labelCls}>Gender {req}</label>
                <select name="gender" defaultValue={reg.gender ?? ""} disabled={!editable} className={cls("gender")}>
                  <option value="">Select…</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Date of birth {req}</label>
                <input type="date" name="dateOfBirth" defaultValue={reg.dateOfBirth ?? ""} disabled={!editable} className={cls("dateOfBirth")} />
                <p className="mt-1 text-[11px] text-faint">Must be 18 years or older.</p>
              </div>
              <div>
                <label className={labelCls}>Ghana Card / Passport number {req}</label>
                <input name="idNumber" defaultValue={reg.idNumber ?? ""} disabled={!editable} className={cls("idNumber")} />
              </div>
              <div>
                <label className={labelCls}>Phone / WhatsApp number {req}</label>
                <input name="phone" defaultValue={reg.phone ?? ""} disabled={!editable} className={cls("phone")} placeholder="0241234567" />
              </div>
              <div>
                <label className={labelCls}>Email address {req}</label>
                <input type="email" name="email" defaultValue={reg.email ?? ""} disabled={!editable} className={cls("email")} placeholder="you@example.com" />
              </div>
              <div>
                <label className={labelCls}>Where are you currently staying? {req}</label>
                <input name="currentAddress" defaultValue={reg.currentAddress ?? ""} disabled={!editable} className={cls("currentAddress")} placeholder="e.g. Madina, Accra" />
              </div>
              <div>
                <label className={labelCls}>Home region / where you&apos;re coming from {req}</label>
                <input name="homeRegion" defaultValue={reg.homeRegion ?? ""} disabled={!editable} className={cls("homeRegion")} placeholder="e.g. Tamale, Northern Region" />
              </div>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-ink-700">Emergency contact</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Name {req}</label>
                <input name="emergencyName" defaultValue={reg.emergencyName ?? ""} disabled={!editable} className={cls("emergencyName")} />
              </div>
              <div>
                <label className={labelCls}>Relationship</label>
                <input name="emergencyRelationship" defaultValue={reg.emergencyRelationship ?? ""} disabled={!editable} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone {req}</label>
                <input name="emergencyPhone" defaultValue={reg.emergencyPhone ?? ""} disabled={!editable} className={cls("emergencyPhone")} />
              </div>
              <div>
                <label className={labelCls}>Email (optional)</label>
                <input type="email" name="emergencyEmail" defaultValue={reg.emergencyEmail ?? ""} disabled={!editable} className={inputCls} />
              </div>
            </div>
          </div>
        </section>

        {/* STEP 2 — Training details */}
        <section className={step === 1 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Training details</h2>
            <div className="mt-4">
              <label className={labelCls}>Preferred batch {req}</label>
              <select name="batchId" defaultValue={reg.batchId ?? ""} disabled={!editable} className={cls("batchId")}>
                <option value="">Select a batch…</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} — {b.startDate} to {b.endDate}
                  </option>
                ))}
              </select>
              {batches.length === 0 && (
                <p className="mt-1 text-xs text-[#a85a2e]">No open batches right now — check back soon.</p>
              )}
            </div>

            <div className="mt-4">
              <label className={labelCls}>Do you plan to stay for the full course duration? {req}</label>
              <div className="mt-1.5 flex gap-4 text-sm text-ink">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="fullDuration"
                    value="yes"
                    disabled={!editable}
                    checked={fullDuration === "yes"}
                    onChange={() => setFullDuration("yes")}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="fullDuration"
                    value="no"
                    disabled={!editable}
                    checked={fullDuration === "no"}
                    onChange={() => setFullDuration("no")}
                  />
                  No
                </label>
              </div>
              {fullDuration === "no" && (
                <input
                  name="partialDurationNote"
                  defaultValue={reg.partialDurationNote ?? ""}
                  disabled={!editable}
                  placeholder="Specify the duration you can attend"
                  className={`${inputCls} mt-2`}
                />
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Accommodation needed? {req}</label>
                <select name="accommodation" defaultValue={reg.accommodation ?? ""} disabled={!editable} className={cls("accommodation")}>
                  <option value="">Select…</option>
                  <option value="YES">Yes — I need hostel (GH₵800/month)</option>
                  <option value="NO">No — I have my own accommodation</option>
                  <option value="NOT_SURE">Not sure — contact me with options</option>
                </select>
                <p className="mt-1 text-[11px] text-faint">
                  Shared room, 2 per room — includes bed, fan, water and light. Meals not included.
                </p>
              </div>
              <div>
                <label className={labelCls}>T-shirt size for PPE {req}</label>
                <select name="tshirtSize" defaultValue={reg.tshirtSize ?? ""} disabled={!editable} className={cls("tshirtSize")}>
                  <option value="">Select…</option>
                  {["S", "M", "L", "XL", "XXL"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* STEP 3 — Education & experience */}
        <section className={step === 2 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Education &amp; experience</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Highest education level {req}</label>
                <select name="educationLevel" defaultValue={reg.educationLevel ?? ""} disabled={!editable} className={cls("educationLevel")}>
                  <option value="">Select…</option>
                  <option value="WASSCE">WASSCE</option>
                  <option value="DIPLOMA">Diploma</option>
                  <option value="HND">HND</option>
                  <option value="DEGREE">Degree</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>If other, specify</label>
                <input name="educationOther" defaultValue={reg.educationOther ?? ""} disabled={!editable} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Prior experience in electrical / solar / energy</label>
                <select name="experienceLevel" defaultValue={reg.experienceLevel ?? ""} disabled={!editable} className={inputCls}>
                  <option value="">Select…</option>
                  <option value="NONE">None</option>
                  <option value="MONTHS_0_6">0–6 months</option>
                  <option value="MONTHS_6_24">6 months – 2 years</option>
                  <option value="YEARS_2_PLUS">2+ years</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Describe your experience</label>
                <input
                  name="experienceNote"
                  defaultValue={reg.experienceNote ?? ""}
                  disabled={!editable}
                  className={inputCls}
                  placeholder="e.g. Apprentice with ECG contractor, 1 year"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Do you have any basic tools?</label>
              <div className="mt-1.5 flex flex-wrap gap-4 text-sm text-ink">
                {TOOL_OPTIONS.map((t) => (
                  <label key={t.value} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="tools"
                      value={t.value}
                      disabled={!editable}
                      checked={tools.has(t.value)}
                      onChange={(e) =>
                        setTools((prev) => {
                          const n = new Set(prev);
                          if (e.target.checked) n.add(t.value);
                          else n.delete(t.value);
                          return n;
                        })
                      }
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-ink-700">Documents</h3>
            <p className="text-xs text-ink-500">Upload your CV/résumé and certificates (WASSCE/Diploma/Degree + any electrical certificates). A passport photo is welcome too.</p>
            <div className="mt-3">{documentsSection}</div>
          </div>
        </section>

        {/* STEP 4 — Medical & safety */}
        <section className={step === 3 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Medical &amp; safety</h2>
            <p className="mt-1 text-xs text-ink-500">For safety during rooftop and field practicals. Examples: epilepsy, fear of heights, asthma.</p>
            <div className="mt-4">
              <label className={labelCls}>Do you have any medical conditions we should know about?</label>
              <div className="mt-1.5 flex gap-4 text-sm text-ink">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="hasMedicalCondition"
                    disabled={!editable}
                    checked={!hasMedicalCondition}
                    onChange={() => setHasMedicalCondition(false)}
                  />
                  No
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="hasMedicalCondition"
                    disabled={!editable}
                    checked={hasMedicalCondition}
                    onChange={() => setHasMedicalCondition(true)}
                  />
                  Yes
                </label>
              </div>
              {hasMedicalCondition && (
                <input
                  name="medicalConditions"
                  defaultValue={reg.medicalConditions ?? ""}
                  disabled={!editable}
                  className={`${inputCls} mt-2`}
                  placeholder="Describe the condition"
                />
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Blood group (optional but recommended)</label>
                <input name="bloodGroup" defaultValue={reg.bloodGroup ?? ""} disabled={!editable} className={inputCls} placeholder="e.g. O+" />
              </div>
            </div>
          </div>
        </section>

        {/* STEP 5 — Referral, sponsorship & declaration */}
        <section className={step === 4 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Referral, sponsorship &amp; declaration</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>How did you hear about us? {req}</label>
                <select name="referralSource" defaultValue={reg.referralSource ?? ""} disabled={!editable} className={cls("referralSource")}>
                  <option value="">Select…</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="FRIEND">Friend</option>
                  <option value="RADIO">Radio</option>
                  <option value="ECG">ECG</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>If other, specify</label>
                <input name="referralOther" defaultValue={reg.referralOther ?? ""} disabled={!editable} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sponsorship</label>
                <select name="sponsorship" defaultValue={reg.sponsorship ?? ""} disabled={!editable} className={inputCls}>
                  <option value="">Select…</option>
                  <option value="SELF">Self-funded</option>
                  <option value="COMPANY">Company</option>
                  <option value="NGO">NGO / Scholarship</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Company / NGO name</label>
                <input name="sponsorName" defaultValue={reg.sponsorName ?? ""} disabled={!editable} className={inputCls} />
              </div>
            </div>

            <div className="mt-5 rounded-[14px] border border-line-soft bg-cream p-4">
              <p className="text-sm text-ink">
                I declare that all information provided is true and correct. I understand that any false
                information will lead to disqualification. I agree to abide by all safety rules during
                training.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Type your full name as your signature {req}</label>
                  <input name="declarationName" defaultValue={reg.declarationName ?? ""} disabled={!editable} className={cls("declarationName")} />
                </div>
                <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="declarationAccepted"
                    defaultChecked={reg.declarationAccepted}
                    disabled={!editable}
                    className={invalid.has("declarationAccepted") ? "outline outline-2 outline-[#b23a2e]" : ""}
                  />
                  I accept the declaration {req}
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* STEP 6 — Review & submit */}
        <section className={step === 5 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Review &amp; save</h2>
            <p className="mt-1 text-sm text-muted">
              Save your details here, then submit and pay from the panel below the form. You can step back
              to edit any section first.
            </p>
            {editable && (
              <button type="submit" className="mt-4 rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep">
                Save registration
              </button>
            )}
          </div>
        </section>

        {editable && (
          <div className="flex items-center justify-between">
            <button type="button" onClick={back} disabled={step === 0} className="rounded-full border border-line px-5 py-2.5 text-sm text-ink disabled:opacity-40">
              ← Back
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white hover:bg-forest-deep">
                Next →
              </button>
            ) : (
              <span />
            )}
          </div>
        )}
      </form>
    </div>
  );
}
