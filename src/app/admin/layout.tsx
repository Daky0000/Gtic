import { hasRole, isDeveloper, requirePortal, ROLES } from "@/lib/rbac";
import { PortalShell, type NavItem } from "@/components/portal-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("admin");

  // Registrar/management see the overview + calendar; the developer console
  // pages (settings, users, audit) are developer / system admin only. Fees &
  // pricing go further: developer ONLY — excluded for the system admin.
  const isConsole = hasRole(user, ROLES.SYSTEM_ADMIN);
  const nav: NavItem[] = [
    { label: "Overview", href: "/admin" },
    { label: "Academic calendar", href: "/admin/calendar" },
    ...(isConsole
      ? [
          { label: "Users & roles", href: "/admin/users" },
          { label: "Forms", href: "/admin/forms" },
          ...(isDeveloper(user) ? [{ label: "Fees & pricing", href: "/admin/fees" }] : []),
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
