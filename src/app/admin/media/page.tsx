import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { appBaseUrl } from "@/lib/base-url";
import { UPLOAD_MIME_BY_EXT } from "@/lib/storage";
import { uploadMediaAsset, deleteMediaAsset } from "@/lib/actions/media";
import { Flash } from "@/components/flash";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Media library" };

const field = "w-full rounded-md border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none";
const ACCEPT = Object.keys(UPLOAD_MIME_BY_EXT).join(",");

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string; q?: string }>;
}) {
  await requireDeveloperConsole();
  const { error, saved, deleted, q } = await searchParams;
  const baseUrl = appBaseUrl();

  const [assets, agg] = await Promise.all([
    db.mediaAsset.findMany({
      where: q ? { fileName: { contains: q, mode: "insensitive" } } : undefined,
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.mediaAsset.aggregate({ _count: true, _sum: { size: true } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Media library</h1>
      <p className="mt-1 text-sm text-ink-500">
        Upload images and documents once, then reuse them anywhere in the app — announcements, course and
        short-course content, public pages. Every file gets a permanent public link.
      </p>
      <p className="mt-1 text-xs text-ink-400">
        {agg._count} file{agg._count === 1 ? "" : "s"} · {formatBytes(agg._sum.size ?? 0)} total
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

      <form className="mt-6 flex gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by filename…" className={`${field} flex-1`} />
        <button type="submit" className="rounded-md border border-ink-300 px-4 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100">
          Search
        </button>
      </form>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {assets.map((asset) => {
          const url = `/api/media/${asset.id}`;
          const isImage = asset.mimeType.startsWith("image/");
          return (
            <div key={asset.id} className="overflow-hidden rounded-2xl border border-line bg-paper">
              <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-ink-50">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={asset.altText ?? asset.fileName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-400">
                    <span className="text-2xl font-bold">
                      {asset.fileName.split(".").pop()?.toUpperCase()}
                    </span>
                  </div>
                )}
              </a>
              <div className="p-3">
                <div className="truncate text-xs font-medium text-ink-700" title={asset.fileName}>
                  {asset.fileName}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-400">
                  {formatBytes(asset.size)} · {asset.createdAt.toLocaleDateString()}
                  {asset.uploadedBy && ` · ${asset.uploadedBy.name}`}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <CopyButton value={`${baseUrl}${url}`} label="Copy link" />
                  <form action={deleteMediaAsset}>
                    <input type="hidden" name="id" value={asset.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-[14px] py-1.5 text-xs font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
        {assets.length === 0 && (
          <p className="col-span-full text-sm text-ink-500">
            {q ? "No files match that search." : "No files uploaded yet."}
          </p>
        )}
      </div>
    </div>
  );
}
