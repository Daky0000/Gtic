import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { publishAnnouncement } from "@/lib/actions/comms";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const user = await requirePortal("staff");
  const canPublish = hasRole(user, ROLES.REGISTRAR, ROLES.MANAGEMENT, ROLES.SYSTEM_ADMIN);

  const announcements = await db.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 20 });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Announcements</h1>

      {canPublish && (
        <form action={publishAnnouncement} className="mt-4 space-y-2 rounded-lg border border-ink-300/60 bg-white p-4">
          <input name="title" placeholder="Title" required className="w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <textarea name="body" placeholder="Message" required rows={3} className="w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm" />
          <select name="audience" className="rounded-md border border-ink-300 px-2 py-1.5 text-sm">
            <option value="ALL">Everyone</option>
            <option value="APPLICANTS">Applicants</option>
            <option value="STUDENTS">Students</option>
            <option value="STAFF">Staff</option>
          </select>
          <button type="submit" className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Publish
          </button>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="rounded-lg border border-ink-300/60 bg-white p-4 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold text-brand-800">{a.title}</span>
              <span className="text-xs text-ink-500">{a.audience}</span>
            </div>
            <p className="mt-1 text-ink-600">{a.body}</p>
            <div className="mt-1 text-xs text-ink-400">{a.publishedAt.toLocaleString()}</div>
          </div>
        ))}
        {announcements.length === 0 && <p className="text-sm text-ink-500">No announcements yet.</p>}
      </div>
    </div>
  );
}
