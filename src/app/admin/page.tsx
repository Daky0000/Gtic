import Link from "next/link";
import { db } from "@/lib/db";
import { hasRole, requirePortal, ROLES } from "@/lib/rbac";

export const metadata = { title: "Administration" };

export default async function AdminHome() {
  const user = await requirePortal("admin");
  const isConsole = hasRole(user, ROLES.SYSTEM_ADMIN);

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

      {isConsole && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-ink-700">Developer console</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-4">
            {(
              [
                ["Users & roles", "/admin/users", "Create accounts, assign and revoke roles"],
                ["Fees", "/admin/fees", "Admission, tuition, hostel and document fees"],
                ["System settings", "/admin/settings", "Integrations (Paystack, Claude) and institution identity"],
                ["Audit log", "/admin/audit", "Every sensitive action, append-only"],
              ] as const
            ).map(([title, href, note]) => (
              <Link key={href} href={href} className="rounded-lg border border-brand-200 bg-brand-50 p-5 hover:bg-brand-100">
                <div className="font-semibold text-brand-900">{title}</div>
                <div className="mt-1 text-xs text-brand-800">{note}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
