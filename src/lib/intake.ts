// Fixed annual intake calendar (published by the Center): applications for a
// programme CLOSE on its admission deadline and reopen when the cohort
// starts — anyone applying after that targets next year's cohort. Pure
// month/day math so it holds for every year, including deadlines that wrap
// the year end (e.g. closes 1 December, cohort starts 3 January).

export type IntakeWindow = {
  admissionClosesMonth: number | null;
  admissionClosesDay: number | null;
  cohortStartsMonth: number | null;
  cohortStartsDay: number | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** month/day → comparable integer (Feb 3 → 203). */
const md = (month: number, day: number) => month * 100 + day;

/** True when applications for this programme are currently open. A programme
 * without a configured window is always open. */
export function isAdmissionOpen(p: IntakeWindow, now: Date = new Date()): boolean {
  if (!p.admissionClosesMonth || !p.admissionClosesDay || !p.cohortStartsMonth || !p.cohortStartsDay) {
    return true;
  }
  const nowMd = md(now.getUTCMonth() + 1, now.getUTCDate());
  const closes = md(p.admissionClosesMonth, p.admissionClosesDay);
  const starts = md(p.cohortStartsMonth, p.cohortStartsDay);
  // Closed during [closes, starts). The window may wrap the year end.
  if (closes <= starts) return !(nowMd >= closes && nowMd < starts);
  return !(nowMd >= closes || nowMd < starts);
}

/** "closes 1 December" / "closed — reopens 3 January", for UI labels. */
export function admissionStatusLabel(p: IntakeWindow, now: Date = new Date()): string | null {
  if (!p.admissionClosesMonth || !p.admissionClosesDay || !p.cohortStartsMonth || !p.cohortStartsDay) {
    return null;
  }
  return isAdmissionOpen(p, now)
    ? `admissions close ${p.admissionClosesDay} ${MONTHS[p.admissionClosesMonth - 1]}`
    : `closed — reopens ${p.cohortStartsDay} ${MONTHS[p.cohortStartsMonth - 1]}`;
}
