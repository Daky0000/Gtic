import { hasRole, requirePortal, ROLES } from "@/lib/rbac";
import { PortalShell, type NavItem } from "@/components/portal-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("admin");

  // Registrar/management see the overview + calendar; the developer console
  // pages (settings, fees, users, audit) are developer / system admin only.
  const isConsole = hasRole(user, ROLES.SYSTEM_ADMIN);
  const nav: NavItem[] = [
    { label: "Overview", href: "/admin" },
    { label: "Academic calendar", href: "/admin/calendar" },
    ...(isConsole
      ? [
          { label: "Users & roles", href: "/admin/users" },
          { label: "Fees", href: "/admin/fees" },
          { label: "System settings", href: "/admin/settings" },
          { label: "Audit log", href: "/admin/audit" },
        ]
      : []),
    { label: "Knowledge base", href: "/admin/knowledge", comingSoon: true },
    { label: "AI usage & budgets", href: "/admin/ai", comingSoon: true },
  ];

  return (
    <PortalShell portalName="Administration" user={user} nav={nav}>
      {children}
    </PortalShell>
  );
}
