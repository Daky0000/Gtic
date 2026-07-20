import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/rbac";
import { readUpload, UPLOAD_MIME_BY_EXT } from "@/lib/storage";

/**
 * Serves files from the private upload store with per-area authorization:
 *  - applications/<appId>/…              → the applicant who owns it, or any staff/admin
 *  - short-course-registrations/<regId>/… → the registrant who owns it, or any staff/admin
 *  - materials/<offeringId>/…             → any signed-in user (course content)
 *  - anything else                        → staff/admin only
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path: segments } = await params;
  const relPath = segments.join("/");
  if (relPath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const isApplicant = user.roles.length === 1 && user.roles[0] === "applicant";
  const isStudentish = user.roles.every((r) => ["applicant", "student", "alumni"].includes(r));
  const isStaffish = !isApplicant && !isStudentish;

  let fileName = path.basename(relPath);

  if (relPath.startsWith("applications/")) {
    const doc = await db.applicationDocument.findFirst({
      where: { filePath: relPath },
      include: { application: { select: { userId: true } } },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (doc.application.userId !== user.id && !isStaffish) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    fileName = doc.fileName;
  } else if (relPath.startsWith("short-course-registrations/")) {
    const doc = await db.shortCourseDocument.findFirst({
      where: { filePath: relPath },
      include: { registration: { select: { userId: true } } },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (doc.registration.userId !== user.id && !isStaffish) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    fileName = doc.fileName;
  } else if (!relPath.startsWith("materials/") && !isStaffish) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let buf: Buffer;
  try {
    buf = await readUpload(relPath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Content-Type comes from the extension allowlist ONLY — never from a
  // stored (historically client-supplied) MIME type, so nothing in the upload
  // store can ever be served as an executable type like text/html.
  const ext = path.extname(relPath).toLowerCase();
  const type = UPLOAD_MIME_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0",
    },
  });
}
