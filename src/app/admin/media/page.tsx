import { requireDeveloperConsole } from "@/lib/rbac";
import { appBaseUrl } from "@/lib/base-url";
import { UPLOAD_MIME_BY_EXT } from "@/lib/storage";
import { listMediaLibrary, formatBytes, isImageFile, type MediaSource } from "@/lib/media-library";
import { uploadMediaAsset, deleteMediaAsset } from "@/lib/actions/media";
import { Flash } from "@/components/flash";
import { CopyButton } from "@/components/copy-button";
import { StatusChip, type ChipTone } from "@/components/ui";

export const metadata = { title: "Media library" };

const field = "w-full rounded-md border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none";
const ACCEPT = Object.keys(UPLOAD_MIME_BY_EXT).join(",");

const SOURCE_META: Record<MediaSource, { label: string; tone: ChipTone }> = {
  library: { label: "Library", tone: "green" },
  application: { label: "Application", tone: "sky" },
  short_course: { label: "Short course", tone: "violet" },
  material: { label: "Course material", tone: "amber" },
};

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string; q?: string; source?: string }>;
}) {
  await requireDeveloperConsole();
  const { error, saved, deleted, q, source } = await searchParams;
  const baseUrl = appBaseUrl();

  const allRows = await listMediaLibrary(q);
  const rows = source ? allRows.filter((r) => r.source === source) : allRows;
  const totalSize = rows.reduce((sum, r) => sum + (r.size ?? 0), 0);
  const unknownSizeCount = rows.filter((r) => r.size == null).length;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Media library</h1>
      <p className="mt-1 text-sm text-ink-500">
        Every file in the system in one place: reusable assets you upload here for use anywhere
        (announcements, course and short-course content, public pages), plus every document applicants,
        short-course registrants and lecturers have uploaded elsewhere. Only library uploads can be
        deleted from this page — the rest stay owned by the flow that created them.
      </p>
      <p className="mt-1 text-xs text-ink-400">
        {rows.length} file{rows.length === 1 ? "" : "s"} · {formatBytes(totalSize)}
        {unknownSizeCount > 0 ? ` known (+${unknownSizeCount} of unknown size)` : ""} total
      </p>
      <Flash
        error={error}
        success={saved ? "File uploaded." : deleted ? "File deleted." : undefined}
      />

      <form
        action={uploadMediaAsset}
        encType="multipart/form-data"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-paper p-5"
      >
        <h2 className="w-full text-sm font-semibold text-brand-800">Add to the library</h2>
        <div>
          <label className="block text-xs text-ink-600">File</label>
          <input type="file" name="file" required accept={ACCEPT} className="mt-1 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-ink-600">Description (optional, used as image alt text)</label>
          <input name="altText" placeholder="e.g. Hostel block A exterior" className={`${field} mt-1`} />
        </div>
        <button type="submit" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
          Upload
        </button>
      </form>

      <form className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by filename…" className={`${field} flex-1`} />
        <select name="source" defaultValue={source ?? ""} className={`${field} w-auto`}>
          <option value="">All sources</option>
          {(Object.keys(SOURCE_META) as MediaSource[]).map((s) => (
            <option key={s} value={s}>{SOURCE_META[s].label}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-ink-300 px-4 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100">
          Filter
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {rows.map((row) => {
          const meta = SOURCE_META[row.source];
          const isImage = isImageFile(row.fileName);
          return (
            <div key={`${row.source}-${row.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-4">
              <a
                href={row.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50"
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.viewUrl} alt={row.fileName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-ink-400">
                    {row.fileName.split(".").pop()?.toUpperCase()}
                  </span>
                )}
              </a>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink-700" title={row.fileName}>
                    {row.fileName}
                  </span>
                  <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-500">{row.context}</div>
                <div className="mt-0.5 text-[11px] text-ink-400">
                  {formatBytes(row.size)} · {row.uploadedAt.toLocaleDateString()}
                  {row.uploaderName && (
                    <> · Uploaded by {row.uploaderName}{row.uploaderEmail ? ` (${row.uploaderEmail})` : ""}</>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <CopyButton value={`${baseUrl}${row.viewUrl}`} label="Copy link" />
                {row.deletable && (
                  <form action={deleteMediaAsset}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-[14px] py-1.5 text-xs font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-sm text-ink-500">
            {q || source ? "No files match." : "No files uploaded yet."}
          </p>
        )}
      </div>
    </div>
  );
}
