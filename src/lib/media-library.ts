import "server-only";
import { db } from "@/lib/db";
import { UPLOAD_MIME_BY_EXT } from "@/lib/storage";

export type MediaSource = "library" | "application" | "short_course" | "material";

export type MediaRow = {
  id: string;
  source: MediaSource;
  fileName: string;
  viewUrl: string;
  size: number | null;
  uploadedAt: Date;
  uploaderName: string | null;
  uploaderEmail: string | null;
  context: string;
  deletable: boolean;
};

const APPLICATION_DOC_LABEL: Record<string, string> = {
  RESULTS_SLIP: "Results slip",
  CERTIFICATE: "Certificate",
  TRANSCRIPT: "Transcript",
  PHOTO: "Passport photo",
  ID_DOCUMENT: "ID document",
  OTHER: "Other",
};

const SHORT_COURSE_DOC_LABEL: Record<string, string> = {
  CV: "CV / résumé",
  CERTIFICATE: "Certificate",
  PHOTO: "Passport photo",
  ID_DOCUMENT: "ID document",
  OTHER: "Other",
};

export function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Extension is the sole authority for "is this an image" — same rule the
 * storage layer uses for Content-Type, never a stored/client-supplied MIME. */
export function isImageFile(fileName: string): boolean {
  const ext = `.${fileName.split(".").pop()?.toLowerCase() ?? ""}`;
  return (UPLOAD_MIME_BY_EXT[ext] ?? "").startsWith("image/");
}

/**
 * Every file users have uploaded anywhere in the system, merged into one
 * feed for the admin media library: the reusable library itself
 * (MediaAsset) plus the per-record documents applicants, short-course
 * registrants and lecturers upload elsewhere (ApplicationDocument,
 * ShortCourseDocument, file-kind Material). Only the library rows are
 * deletable here — the others stay owned by their originating flow.
 *
 * Assignment submissions are deliberately excluded: the current student
 * e-learning UI only ever captures submission text, never a file, so
 * Submission.filePath is always null — there is nothing to list.
 */
export async function listMediaLibrary(q?: string): Promise<MediaRow[]> {
  const nameFilter = q ? { contains: q, mode: "insensitive" as const } : undefined;

  const [library, appDocs, scDocs, materials] = await Promise.all([
    db.mediaAsset.findMany({
      where: nameFilter ? { fileName: nameFilter } : undefined,
      include: { uploadedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.applicationDocument.findMany({
      where: nameFilter ? { fileName: nameFilter } : undefined,
      include: { application: { select: { refNo: true, user: { select: { name: true, email: true } } } } },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    }),
    db.shortCourseDocument.findMany({
      where: nameFilter ? { fileName: nameFilter } : undefined,
      include: {
        registration: {
          select: {
            user: { select: { name: true, email: true } },
            shortCourse: { select: { name: true } },
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    }),
    db.material.findMany({
      where: { filePath: { not: null }, ...(nameFilter ? { title: nameFilter } : {}) },
      include: { offering: { select: { course: { select: { code: true, title: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const creatorIds = [...new Set(materials.map((m) => m.createdById).filter((v): v is string => !!v))];
  const creators = creatorIds.length
    ? await db.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const creatorById = new Map(creators.map((c) => [c.id, c]));

  const rows: MediaRow[] = [
    ...library.map((a): MediaRow => ({
      id: a.id,
      source: "library",
      fileName: a.fileName,
      viewUrl: `/api/media/${a.id}`,
      size: a.size,
      uploadedAt: a.createdAt,
      uploaderName: a.uploadedBy?.name ?? null,
      uploaderEmail: a.uploadedBy?.email ?? null,
      context: "Media library",
      deletable: true,
    })),
    ...appDocs.map((d): MediaRow => ({
      id: d.id,
      source: "application",
      fileName: d.fileName,
      viewUrl: `/api/files/${d.filePath}`,
      size: d.size,
      uploadedAt: d.uploadedAt,
      uploaderName: d.application.user.name,
      uploaderEmail: d.application.user.email,
      context: `Application document · ${APPLICATION_DOC_LABEL[d.kind] ?? d.kind} · ${d.application.refNo}`,
      deletable: false,
    })),
    ...scDocs.map((d): MediaRow => ({
      id: d.id,
      source: "short_course",
      fileName: d.fileName,
      viewUrl: `/api/files/${d.filePath}`,
      size: d.size,
      uploadedAt: d.uploadedAt,
      uploaderName: d.registration.user.name,
      uploaderEmail: d.registration.user.email,
      context: `Short course document · ${SHORT_COURSE_DOC_LABEL[d.kind] ?? d.kind} — ${d.registration.shortCourse.name}`,
      deletable: false,
    })),
    ...materials
      .filter((m): m is typeof m & { filePath: string } => !!m.filePath)
      .map((m): MediaRow => {
        const creator = m.createdById ? creatorById.get(m.createdById) : undefined;
        const ext = m.filePath.split(".").pop()?.toLowerCase();
        return {
          id: m.id,
          source: "material",
          fileName: ext ? `${m.title}.${ext}` : m.title,
          viewUrl: `/api/files/${m.filePath}`,
          size: null,
          uploadedAt: m.createdAt,
          uploaderName: creator?.name ?? null,
          uploaderEmail: creator?.email ?? null,
          context: `Course material · ${m.offering.course.code} ${m.offering.course.title}`,
          deletable: false,
        };
      }),
  ];

  rows.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  return rows;
}
