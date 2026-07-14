import { db } from "@/lib/db";
import type { Audience } from "@prisma/client";

export async function AnnouncementsBanner({ audience }: { audience: Audience }) {
  const announcements = await db.announcement.findMany({
    where: { OR: [{ audience: "ALL" }, { audience }] },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });
  if (announcements.length === 0) return null;

  return (
    <div className="space-y-2">
      {announcements.map((a) => (
        <div key={a.id} className="rounded-md border border-ink-300/60 bg-white p-3 text-sm">
          <div className="font-medium text-brand-800">{a.title}</div>
          <p className="mt-0.5 text-ink-600">{a.body}</p>
          <div className="mt-1 text-xs text-ink-400">{a.publishedAt.toLocaleDateString()}</div>
        </div>
      ))}
    </div>
  );
}
