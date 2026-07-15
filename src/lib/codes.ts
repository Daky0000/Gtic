// Human-facing identifiers: application refs, verification codes, invoice/index numbers.
// Formats are simple and readable — swap for institution-configured formats later (SYS-15/REG-15).
import { randomInt } from "node:crypto";

function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randomAlnum(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 ambiguity
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function applicationRefNo(year: string): string {
  const clean = year.replace(/[^A-Za-z0-9]/g, "");
  return `APP-${clean}-${randomDigits(6)}`;
}

export function verificationCode(): string {
  return `CC-${randomAlnum(4)}-${randomAlnum(4)}`;
}

export function invoiceNo(kind: string): string {
  return `INV-${kind.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${randomDigits(3)}`;
}

export function paymentReference(): string {
  return `PAY-${Date.now().toString(36).toUpperCase()}${randomAlnum(4)}`;
}

export function indexNumber(yearLabel: string): string {
  // e.g. "2026" + 5 random digits — format is configurable in a later phase.
  const yy = yearLabel.slice(0, 4);
  return `${yy}${randomDigits(5)}`;
}

export function voucherSerial(): string {
  return `V${randomAlnum(3)}${randomDigits(5)}`;
}

export function voucherPin(): string {
  return randomDigits(8);
}

export function staffNo(): string {
  return `STF${randomDigits(5)}`;
}

// System-generated temporary passwords (voucher-pay-first signup): must use a
// CSPRNG, unlike the display codes above which are shown publicly and don't
// gate access to anything.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no O/0/I/l/1
export function generatedPassword(length = 12): string {
  let s = "";
  for (let i = 0; i < length; i++) s += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  return s;
}
