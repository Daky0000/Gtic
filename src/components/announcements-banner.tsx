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
    <div className="space-y-3">
      {announcements.map((a) => (
        <div
          key={a.id}
          className="flex items-baseline gap-4 rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-forest"
        >
          <span className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#eaf0ea] px-[10px] py-[5px] font-mono text-[11px] uppercase tracking-[0.06em] text-moss">
            {a.publishedAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </span>
          <div>
            <div className="font-serif text-[18px] text-ink">{a.title}</div>
            <p className="mt-0.5 text-sm leading-[1.55] text-muted">{a.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
