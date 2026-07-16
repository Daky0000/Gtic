import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";

export const metadata = { title: "Audit Log" };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireDeveloperConsole();
  const { q } = await searchParams;

  const events = await db.auditLog.findMany({
    where: q ? { action: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const actorIds = [...new Set(events.map((e) => e.actorId).filter(Boolean))] as string[];
  const actors = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } });
  const actorEmail = new Map(actors.map((a) => [a.id, a.email]));

  return (
    <div>
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="mt-1 text-sm text-ink-500">The last 100 events (append-only).</p>

      <form className="mt-4 flex max-w-md gap-2">
        <input
          name="q" defaultValue={q ?? ""} placeholder="Filter by action, e.g. admissions."
          className="flex-1 rounded-md border border-ink-300 px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md border border-ink-300 px-4 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100">
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-ink-100 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-ink-500">{e.createdAt.toLocaleString()}</td>
                <td className="px-4 py-2 text-xs">{e.actorId ? (actorEmail.get(e.actorId) ?? e.actorId) : "system"}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2 text-xs text-ink-500">
                  {e.entityType}{e.entityId ? ` · ${e.entityId.slice(0, 12)}…` : ""}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No events match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
