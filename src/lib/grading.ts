// Grading rules, matching the bands published in the student handbook
// (REG-03: institution-configurable in a later phase; fixed here for v1).

export type GradeBand = { grade: string; point: number; min: number };

export const GRADE_BANDS: GradeBand[] = [
  { grade: "A", point: 4.0, min: 70 },
  { grade: "B", point: 3.0, min: 60 },
  { grade: "C", point: 2.0, min: 50 },
  { grade: "D", point: 1.0, min: 40 },
  { grade: "F", point: 0.0, min: 0 },
];

export function scoreToGrade(total: number): { grade: string; point: number } {
  const band = GRADE_BANDS.find((b) => total >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
  return { grade: band.grade, point: band.point };
}

export const PASS_MARK = 40;

export function classOfDegree(cumulativeAverage: number): string {
  if (cumulativeAverage >= 70) return "First Class";
  if (cumulativeAverage >= 60) return "Second Class Upper";
  if (cumulativeAverage >= 50) return "Second Class Lower";
  if (cumulativeAverage >= PASS_MARK) return "Pass";
  return "Fail";
}
