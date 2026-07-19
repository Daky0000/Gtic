"use client";

import { useMemo, useState } from "react";
import { admissionStatusLabel, isAdmissionOpen, type IntakeWindow } from "@/lib/intake";

export type ProgrammeOption = IntakeWindow & { id: string; name: string };
export type SchoolGroup = {
  id: string;
  name: string;
  programmes: ProgrammeOption[];
};

type Choice = { rank: number; programmeId: string };

const field =
  "mt-1.5 w-full rounded-[11px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-forest disabled:opacity-70";
const fieldError = "border-[#b23a2e] bg-[#faece9]";
const label = "block text-[13px] text-muted";

const STEPS = ["Personal details", "Examination results", "Programme choices", "Review & submit"];

export function ApplicationWizard({
  app,
  schools,
  choices,
  results,
  editable,
  initialStep,
  resultsSlipForm,
  saveAction,
}: {
  saveAction: (formData: FormData) => Promise<void>;
  app: {
    id: string;
    surname: string | null;
    firstName: string | null;
    otherNames: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    nationality: string | null;
    phone: string | null;
    address: string | null;
    emergencyName: string | null;
    emergencyPhone: string | null;
    qualificationType: string | null;
    examIndexNo: string | null;
    examYear: string | null;
  };
  schools: SchoolGroup[];
  choices: Choice[];
  results: { subject: string; grade: string }[];
  editable: boolean;
  initialStep: number;
  /** The results-slip AI upload form (a server-action form) rendered above the results grid. */
  resultsSlipForm: React.ReactNode;
}) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), STEPS.length - 1));
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [choiceState, setChoiceState] = useState<Record<number, string>>({
    1: choices.find((c) => c.rank === 1)?.programmeId ?? "",
    2: choices.find((c) => c.rank === 2)?.programmeId ?? "",
    3: choices.find((c) => c.rank === 3)?.programmeId ?? "",
  });

  const RESULT_ROWS = 9;
  // Required fields per step (by input name). Step 3 (review) has none.
  const requiredByStep: Record<number, string[]> = useMemo(
    () => ({
      0: ["surname", "firstName", "dateOfBirth", "gender", "nationality", "phone"],
      1: ["qualificationType"],
      2: ["choice1"],
      3: [],
    }),
    []
  );

  const chosen = new Set(Object.values(choiceState).filter(Boolean));

  function validateStep(current: number): boolean {
    if (!editable) return true;
    const form = document.getElementById("application-form") as HTMLFormElement | null;
    if (!form) return true;
    const missing = new Set<string>();
    for (const name of requiredByStep[current] ?? []) {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (el && !el.value.trim()) missing.add(name);
    }
    setInvalid(missing);
    if (missing.size > 0) {
      const first = form.elements.namedItem([...missing][0]) as HTMLElement | null;
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return missing.size === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // Validate every step's required fields before the save action fires; jump
  // to and highlight the first offending step if anything is missing.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!editable) return;
    const form = e.currentTarget;
    const missing = new Set<string>();
    let firstBadStep = -1;
    for (const [stepIdx, names] of Object.entries(requiredByStep)) {
      for (const name of names) {
        const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
        if (el && !el.value.trim()) {
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

  const cls = (name: string) => `${field} ${invalid.has(name) ? fieldError : ""}`;
  const req = <span className="text-[#b23a2e]">*</span>;

  return (
    <div className="mt-6">
      {/* Step indicator */}
      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => (i < step ? setStep(i) : i === step ? null : validateStep(step) && setStep(i))}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                i === step
                  ? "bg-forest text-white"
                  : i < step
                    ? "bg-[#eaf0ea] text-forest"
                    : "bg-line-soft text-faint"
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

      {/* One form spanning all steps; hidden steps still submit their values. */}
      <form id="application-form" action={saveAction} onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="applicationId" value={app.id} />

        {/* STEP 1 — Personal details */}
        <section className={step === 0 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Personal details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Surname {req}</label>
                <input name="surname" defaultValue={app.surname ?? ""} disabled={!editable} className={cls("surname")} />
              </div>
              <div>
                <label className={label}>First name {req}</label>
                <input name="firstName" defaultValue={app.firstName ?? ""} disabled={!editable} className={cls("firstName")} />
              </div>
              <div>
                <label className={label}>Other names</label>
                <input name="otherNames" defaultValue={app.otherNames ?? ""} disabled={!editable} className={field} />
              </div>
              <div>
                <label className={label}>Date of birth {req}</label>
                <input type="date" name="dateOfBirth" defaultValue={app.dateOfBirth ?? ""} disabled={!editable} className={cls("dateOfBirth")} />
              </div>
              <div>
                <label className={label}>Gender {req}</label>
                <select name="gender" defaultValue={app.gender ?? ""} disabled={!editable} className={cls("gender")}>
                  <option value="">Select…</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>
              <div>
                <label className={label}>Nationality {req}</label>
                <input name="nationality" defaultValue={app.nationality ?? "Ghanaian"} disabled={!editable} className={cls("nationality")} />
              </div>
              <div>
                <label className={label}>Phone {req}</label>
                <input name="phone" defaultValue={app.phone ?? ""} disabled={!editable} className={cls("phone")} />
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
          </div>
        </section>

        {/* STEP 2 — Examination results */}
        <section className={step === 1 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Examination results</h2>

            {/* AI results-slip upload — above the manual entry, as requested */}
            {editable && <div className="mt-4">{resultsSlipForm}</div>}

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label className={label}>Qualification type {req}</label>
                <select name="qualificationType" defaultValue={app.qualificationType ?? "WASSCE"} disabled={!editable} className={cls("qualificationType")}>
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

            <h3 className="mt-5 text-sm font-semibold text-ink-700">Your grades</h3>
            <p className="text-xs text-ink-500">Enter each subject and grade, or use the AI upload above to fill these in for you to confirm.</p>
            <div className="mt-3 space-y-2">
              {Array.from({ length: RESULT_ROWS }).map((_, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input name={`subject_${i}`} placeholder="Subject" disabled={!editable} defaultValue={results[i]?.subject ?? ""} className={field} />
                  <input name={`grade_${i}`} placeholder="Grade" disabled={!editable} defaultValue={results[i]?.grade ?? ""} className={field} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* STEP 3 — Programme choices (no duplicates) */}
        <section className={step === 2 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Programme choices</h2>
            <p className="mt-1 text-xs text-ink-500">Pick up to three different programmes in order of preference — you can&apos;t choose the same one twice.</p>
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((rank) => (
                <div key={rank}>
                  <label className={label}>Choice {rank} {rank === 1 ? req : null}</label>
                  <select
                    name={`choice${rank}`}
                    value={choiceState[rank] ?? ""}
                    onChange={(e) => {
                      setChoiceState((s) => ({ ...s, [rank]: e.target.value }));
                      setInvalid((prev) => {
                        const n = new Set(prev);
                        n.delete(`choice${rank}`);
                        return n;
                      });
                    }}
                    disabled={!editable}
                    className={cls(`choice${rank}`)}
                  >
                    <option value="">Select a programme…</option>
                    {schools.map((s) => (
                      <optgroup key={s.id} label={s.name}>
                        {s.programmes.map((p) => {
                          const open = isAdmissionOpen(p);
                          const status = admissionStatusLabel(p);
                          // Disable if closed, or already chosen in another slot.
                          const takenElsewhere = chosen.has(p.id) && choiceState[rank] !== p.id;
                          return (
                            <option key={p.id} value={p.id} disabled={!open || takenElsewhere}>
                              {p.name}
                              {takenElsewhere ? " — already chosen" : status ? ` — ${status}` : ""}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* STEP 4 — Review & submit */}
        <section className={step === 3 ? "" : "hidden"}>
          <div className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">Review &amp; save</h2>
            <p className="mt-1 text-sm text-muted">
              Save your details, then upload any remaining documents and submit from the panel below.
              You can step back to edit any section.
            </p>
            {editable && (
              <button
                type="submit"
                className="mt-4 rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-deep"
              >
                Save application
              </button>
            )}
          </div>
        </section>

        {/* Step nav */}
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
