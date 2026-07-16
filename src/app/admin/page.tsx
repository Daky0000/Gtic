import Link from "next/link";
import { db } from "@/lib/db";
import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Administration" };

const TINTS = ["#8AA84B", "#E7B54A", "#6FA9C4", "#7E6BB0"];

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
    <div className="scr">
      <PageHeader
        title={<>Administration <em className="text-forest">overview.</em></>}
        lead="SYDA — Green Energy & Innovation Center · system at a glance."
      />

      <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([title, value, note], i) => (
          <Stat key={title} n={value} label={title} sub={note} tint={TINTS[i % TINTS.length]} />
        ))}
      </div>

      {isConsole && (
        <div className="mt-8">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            Developer console
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Users & roles", "/admin/users", "Create accounts, assign and revoke roles"],
                ["Fees", "/admin/fees", "Admission, tuition, hostel and document fees"],
                ["System settings", "/admin/settings", "Integrations (Paystack, Claude) and institution identity"],
                ["Audit log", "/admin/audit", "Every sensitive action, append-only"],
              ] as const
            ).map(([title, href, note]) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-forest"
              >
                <div className="font-serif text-[19px] text-ink">{title}</div>
                <div className="mt-1 text-xs leading-[1.5] text-muted">{note}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
