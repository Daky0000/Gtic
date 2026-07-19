import { describe, expect, it } from "vitest";
import {
  cedisToPesewas, formatGHS, formatUSDEquivalent, parseUsdRate, percentPaid, usdToPesewas,
} from "@/lib/money";

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

describe("parseUsdRate (currency multiplier)", () => {
  it("accepts sane positive rates", () => {
    expect(parseUsdRate("15.50")).toBe(15.5);
    expect(parseUsdRate(" 12 ")).toBe(12);
    expect(parseUsdRate("0.01")).toBe(0.01);
  });

  it("rejects junk, zero, negatives, and absurd values", () => {
    expect(parseUsdRate("")).toBeNull();
    expect(parseUsdRate(null)).toBeNull();
    expect(parseUsdRate(undefined)).toBeNull();
    expect(parseUsdRate("abc")).toBeNull();
    expect(parseUsdRate("0")).toBeNull();
    expect(parseUsdRate("-15")).toBeNull();
    expect(parseUsdRate("10001")).toBeNull();
    expect(parseUsdRate("Infinity")).toBeNull();
  });
});

describe("usdToPesewas", () => {
  it("converts dollars to pesewas at the given rate", () => {
    expect(usdToPesewas(25, 15.5)).toBe(38750); // $25 → GHS 387.50
    expect(usdToPesewas(1, 15.5)).toBe(1550);
    expect(usdToPesewas(0, 15.5)).toBe(0);
  });

  it("rounds to the nearest whole pesewa", () => {
    expect(usdToPesewas(0.999, 15.5)).toBe(1548); // 1548.45 → 1548
    expect(usdToPesewas(1.005, 10)).toBe(1005);
  });
});

describe("formatUSDEquivalent", () => {
  it("round-trips a USD-priced fee back to the same dollars", () => {
    expect(formatUSDEquivalent(usdToPesewas(25, 15.5), 15.5)).toBe("$25.00");
    expect(formatUSDEquivalent(usdToPesewas(199.99, 12.34), 12.34)).toBe("$199.99");
  });

  it("formats with thousands separators", () => {
    expect(formatUSDEquivalent(1550000, 15.5)).toBe("$1,000.00");
  });
});
