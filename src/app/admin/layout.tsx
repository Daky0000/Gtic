import { hasRole, isDeveloper, requirePortal, ROLES } from "@/lib/rbac";
import { getHiddenFeatureKeys, visibleNav } from "@/lib/feature-flags";
import { PortalShell, type NavItem } from "@/components/portal-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("admin");
  const dev = isDeveloper(user);

  // Registrar/management see the overview + calendar; the console pages
  // (settings, users, forms, audit) are developer / system admin. Fees &
  // pricing live in the separate developer portal — excluded here entirely.
  const isConsole = hasRole(user, ROLES.SYSTEM_ADMIN);
  const rawNav: NavItem[] = [
    { label: "Overview", href: "/admin" },
    { label: "Academic calendar", href: "/admin/calendar" },
    ...(isConsole
      ? [
          { label: "Users & roles", href: "/admin/users" },
          { label: "Forms", href: "/admin/forms" },
          { label: "Audit log", href: "/admin/audit" },
        ]
      : []),
    ...(dev ? [{ label: "Developer console ↗", href: "/developer" }] : []),
    { label: "Knowledge base", href: "/admin/knowledge", comingSoon: true },
    { label: "AI usage & budgets", href: "/admin/ai", comingSoon: true },
  ];
  const hidden = await getHiddenFeatureKeys();
  const nav = visibleNav(rawNav, hidden, dev);

  return (
    <PortalShell portalName="Administration" user={user} nav={nav}>
      {children}
    </PortalShell>
  );
}
