import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { db } from "@/lib/db";
import { readUpload, UPLOAD_MIME_BY_EXT } from "@/lib/storage";

/**
 * Public, unauthenticated media serving — deliberately different from
 * /api/files (which is per-record and owner/staff-only): media library
 * assets exist specifically to be embedded/linked from public-facing
 * content, so anyone with the link (or the <img> tag it's embedded in)
 * can view it. Long-lived cache since a given id's bytes never change —
 * replacing an asset means uploading a new one with a new id.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let buf: Buffer;
  try {
    buf = await readUpload(asset.filePath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Content-Type comes from the extension allowlist ONLY — never a stored
  // client-supplied MIME type — so nothing here can be served as text/html.
  const ext = path.extname(asset.filePath).toLowerCase();
  const type = UPLOAD_MIME_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${asset.fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
