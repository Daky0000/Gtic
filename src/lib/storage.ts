import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// File storage adapter: local disk by default (storage/uploads, gitignored),
// swappable for S3-compatible storage later without touching call sites.

const ROOT = path.join(process.cwd(), "storage", "uploads");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * The extension is the single authority for what a file IS: it drives both
 * acceptance here and the Content-Type when served. The browser-supplied MIME
 * type is never stored or trusted — a renamed payload can at worst be served
 * under one of these inert types, never as text/html or image/svg+xml.
 */
export const UPLOAD_MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".mp4": "video/mp4",
};

/** Human-readable rejection reason, or null when the file is acceptable. */
export function uploadRejection(
  file: File,
  opts?: { maxBytes?: number; allowedExtensions?: readonly string[] }
): string | null {
  const maxBytes = opts?.maxBytes ?? MAX_UPLOAD_BYTES;
  if (file.size === 0) return "Choose a file to upload.";
  if (file.size > maxBytes) {
    return `File is too large — maximum ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  }
  const ext = path.extname(file.name).toLowerCase();
  const allowed = opts?.allowedExtensions ?? Object.keys(UPLOAD_MIME_BY_EXT);
  if (!allowed.includes(ext) || !UPLOAD_MIME_BY_EXT[ext]) {
    const kinds = allowed.map((e) => e.slice(1).toUpperCase()).join(", ");
    return `That file type is not accepted. Allowed: ${kinds}.`;
  }
  return null;
}

export async function saveUpload(
  file: File,
  subdir: string
): Promise<{ filePath: string; fileName: string; mimeType: string; size: number }> {
  const rejection = uploadRejection(file);
  if (rejection) throw new Error(rejection);

  const dir = path.join(ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(file.name).toLowerCase();
  const storedName = `${randomUUID()}${ext}`;
  const fullPath = path.join(dir, storedName);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buf);

  return {
    filePath: path.join(subdir, storedName).replace(/\\/g, "/"),
    fileName: file.name,
    mimeType: UPLOAD_MIME_BY_EXT[ext],
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
