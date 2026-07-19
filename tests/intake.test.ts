import { describe, expect, it } from "vitest";
import { admissionStatusLabel, isAdmissionOpen } from "@/lib/intake";

// SENG per the published calendar: admission closes 1 Dec, cohort starts 3 Jan.
const SENG = { admissionClosesMonth: 12, admissionClosesDay: 1, cohortStartsMonth: 1, cohortStartsDay: 3 };
// BENG: closes 1 Apr, cohort starts 1 May (no year wrap).
const BENG = { admissionClosesMonth: 4, admissionClosesDay: 1, cohortStartsMonth: 5, cohortStartsDay: 1 };

const at = (iso: string) => new Date(iso);

describe("isAdmissionOpen (year-wrapping window, SENG)", () => {
  it("is open through the year until the deadline", () => {
    expect(isAdmissionOpen(SENG, at("2026-07-19T12:00:00Z"))).toBe(true);
    expect(isAdmissionOpen(SENG, at("2026-11-30T23:59:00Z"))).toBe(true);
  });
  it("closes on the deadline day and stays closed until the cohort starts", () => {
    expect(isAdmissionOpen(SENG, at("2026-12-01T00:00:00Z"))).toBe(false);
    expect(isAdmissionOpen(SENG, at("2026-12-25T12:00:00Z"))).toBe(false);
    expect(isAdmissionOpen(SENG, at("2027-01-02T12:00:00Z"))).toBe(false);
  });
  it("reopens the day the cohort starts", () => {
    expect(isAdmissionOpen(SENG, at("2027-01-03T00:00:00Z"))).toBe(true);
  });
});

describe("isAdmissionOpen (same-year window, BENG)", () => {
  it("open before the deadline, closed between deadline and cohort start", () => {
    expect(isAdmissionOpen(BENG, at("2026-03-31T12:00:00Z"))).toBe(true);
    expect(isAdmissionOpen(BENG, at("2026-04-01T00:00:00Z"))).toBe(false);
    expect(isAdmissionOpen(BENG, at("2026-04-15T12:00:00Z"))).toBe(false);
    expect(isAdmissionOpen(BENG, at("2026-05-01T00:00:00Z"))).toBe(true);
    expect(isAdmissionOpen(BENG, at("2026-12-31T12:00:00Z"))).toBe(true);
  });
});

describe("unconfigured programmes", () => {
  it("are always open", () => {
    const open = { admissionClosesMonth: null, admissionClosesDay: null, cohortStartsMonth: null, cohortStartsDay: null };
    expect(isAdmissionOpen(open, at("2026-12-15T12:00:00Z"))).toBe(true);
    expect(admissionStatusLabel(open)).toBeNull();
  });
});

describe("admissionStatusLabel", () => {
  it("names the deadline while open and the reopen date while closed", () => {
    expect(admissionStatusLabel(SENG, at("2026-07-19T12:00:00Z"))).toBe("admissions close 1 December");
    expect(admissionStatusLabel(SENG, at("2026-12-15T12:00:00Z"))).toBe("closed — reopens 3 January");
  });
});
