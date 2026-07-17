import { describe, expect, it } from "vitest";
import { cedisToPesewas, formatGHS, percentPaid } from "@/lib/money";

describe("formatGHS", () => {
  it("formats pesewas as cedis with two decimals", () => {
    expect(formatGHS(5000)).toBe("GHS 50.00");
    expect(formatGHS(123456)).toBe("GHS 1,234.56");
    expect(formatGHS(1)).toBe("GHS 0.01");
  });
});

describe("cedisToPesewas", () => {
  it("converts and rounds to the nearest pesewa", () => {
    expect(cedisToPesewas(50)).toBe(5000);
    expect(cedisToPesewas(0.015)).toBe(2);
  });
});

describe("percentPaid (fee gates)", () => {
  it("treats a zero or negative total as fully paid", () => {
    expect(percentPaid({ total: 0, paid: 0 })).toBe(100);
    expect(percentPaid({ total: -5, paid: 0 })).toBe(100);
  });

  it("rounds partial payment to the nearest percent", () => {
    expect(percentPaid({ total: 1000, paid: 0 })).toBe(0);
    expect(percentPaid({ total: 1000, paid: 700 })).toBe(70);
    expect(percentPaid({ total: 3000, paid: 1000 })).toBe(33);
  });

  it("caps at 100 even when overpaid", () => {
    expect(percentPaid({ total: 1000, paid: 1000 })).toBe(100);
    expect(percentPaid({ total: 1000, paid: 2500 })).toBe(100);
  });

  it("sits just under the 70% registration gate at 69.4%", () => {
    // Rounding must not wave a 69.4%-paid student through the 70% gate.
    expect(percentPaid({ total: 10000, paid: 6940 })).toBeLessThan(70);
    expect(percentPaid({ total: 10000, paid: 6950 })).toBe(70);
  });
});
