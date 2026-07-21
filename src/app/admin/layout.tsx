import { hasRole, isDeveloper, requirePortal, ROLES } from "@/lib/rbac";
import { getHiddenFeatureKeys, visibleNav } from "@/lib/feature-flags";
import { PortalShell, type NavItem } from "@/components/portal-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("admin");
  const dev = isDeveloper(user);

  // Registrar/management see the overview + calendar; the console pages
  // (settings, users, forms, audit, fees, notifications) are developer /
  // system admin. Fees & pricing is shared with the developer portal (same
  // component, same page) minus the currency multiplier and processing fee,
  // which stay a developer-only decision.
  const isConsole = hasRole(user, ROLES.SYSTEM_ADMIN);
  const rawNav: NavItem[] = [
    { label: "Overview", href: "/admin" },
    { label: "Academic calendar", href: "/admin/calendar" },
    ...(isConsole
      ? [
          { label: "Users & roles", href: "/admin/users" },
          { label: "Forms", href: "/admin/forms" },
          { label: "Fees & pricing", href: "/admin/fees" },
          { label: "Notifications", href: "/admin/notifications" },
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
