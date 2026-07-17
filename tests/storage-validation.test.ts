import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, uploadRejection } from "@/lib/storage";

function fakeFile(name: string, size: number, type = ""): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("uploadRejection", () => {
  it("accepts an ordinary PDF", () => {
    expect(uploadRejection(fakeFile("transcript.pdf", 1024, "application/pdf"))).toBeNull();
  });

  it("rejects empty and oversized files", () => {
    expect(uploadRejection(fakeFile("empty.pdf", 0))).toMatch(/choose a file/i);
    expect(uploadRejection(fakeFile("big.pdf", MAX_UPLOAD_BYTES + 1))).toMatch(/too large/i);
  });

  it("rejects executable/web content regardless of the claimed MIME type", () => {
    // The browser-supplied type is attacker-controlled; the extension decides.
    expect(uploadRejection(fakeFile("evil.html", 100, "application/pdf"))).toMatch(/not accepted/i);
    expect(uploadRejection(fakeFile("evil.svg", 100, "image/png"))).toMatch(/not accepted/i);
    expect(uploadRejection(fakeFile("noextension", 100, "application/pdf"))).toMatch(/not accepted/i);
  });

  it("enforces a caller-specific allowlist (application documents)", () => {
    const allowed = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
    expect(uploadRejection(fakeFile("notes.docx", 100), { allowedExtensions: allowed })).toMatch(
      /not accepted/i
    );
    expect(uploadRejection(fakeFile("photo.jpg", 100), { allowedExtensions: allowed })).toBeNull();
  });

  it("is case-insensitive on extensions", () => {
    expect(uploadRejection(fakeFile("SCAN.PDF", 100))).toBeNull();
  });
});
