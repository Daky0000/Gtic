import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// paystack.ts pulls in the settings layer (and through it the DB client);
// the pure signature check needs neither.
vi.mock("@/lib/settings", () => ({ getSetting: vi.fn(), SETTING_KEYS: {} }));

import { paystackSignatureMatches } from "@/lib/paystack";

const KEY = "sk_test_secret";
const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_1", amount: 5000 } });
const sign = (payload: string, key: string) =>
  createHmac("sha512", key).update(payload).digest("hex");

describe("paystackSignatureMatches", () => {
  it("accepts a signature computed with the configured key", () => {
    expect(paystackSignatureMatches(body, sign(body, KEY), KEY)).toBe(true);
  });

  it("rejects a signature made with a different key", () => {
    expect(paystackSignatureMatches(body, sign(body, "sk_wrong"), KEY)).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const tampered = body.replace("5000", "1");
    expect(paystackSignatureMatches(tampered, sign(body, KEY), KEY)).toBe(false);
  });

  it("rejects missing signature or missing key outright", () => {
    expect(paystackSignatureMatches(body, null, KEY)).toBe(false);
    expect(paystackSignatureMatches(body, sign(body, KEY), null)).toBe(false);
    expect(paystackSignatureMatches(body, "", KEY)).toBe(false);
  });
});
