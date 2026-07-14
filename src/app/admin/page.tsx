import { db } from "@/lib/db";
import { requirePortal } from "@/lib/rbac";

export const metadata = { title: "Administration" };

export default async function AdminHome() {
  await requirePortal("admin");

  const [users, roles, docs, aiCalls] = await Promise.all([
    db.user.count(),
    db.role.count(),
    db.knowledgeDocument.count({ where: { status: "PUBLISHED" } }),
    db.aIAuditLog.count(),
  ]);

  const stats: [string, number, string][] = [
    ["Users", users, "accounts in the system"],
    ["Roles", roles, "defined roles"],
    ["Knowledge documents", docs, "published to the AI assistant"],
    ["AI calls", aiCalls, "logged in the AI audit trail"],
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">System overview</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {stats.map(([title, value, note]) => (
          <div key={title} className="rounded-lg border border-ink-300/60 bg-white p-5">
            <div className="text-sm font-medium text-ink-500">{title}</div>
            <div className="mt-1 text-2xl font-bold text-brand-800">{value}</div>
            <div className="mt-1 text-xs text-ink-500">{note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
