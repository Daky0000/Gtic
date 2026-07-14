import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// File storage adapter: local disk by default (storage/uploads, gitignored),
// swappable for S3-compatible storage later without touching call sites.

const ROOT = path.join(process.cwd(), "storage", "uploads");

export async function saveUpload(
  file: File,
  subdir: string
): Promise<{ filePath: string; fileName: string; mimeType: string; size: number }> {
  const dir = path.join(ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || "";
  const storedName = `${randomUUID()}${ext}`;
  const fullPath = path.join(dir, storedName);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buf);

  return {
    filePath: path.join(subdir, storedName).replace(/\\/g, "/"),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: buf.length,
  };
}

export async function readUpload(relPath: string): Promise<Buffer> {
  return fs.readFile(path.join(ROOT, relPath));
}

export async function uploadAsBase64(relPath: string): Promise<string> {
  const buf = await readUpload(relPath);
  return buf.toString("base64");
}
