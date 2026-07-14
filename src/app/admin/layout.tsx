import { requirePortal } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("admin");
  return (
    <PortalShell
      portalName="Administration"
      user={user}
      nav={[
        { label: "Overview", href: "/admin" },
        { label: "Users & roles", href: "/admin/users", comingSoon: true },
        { label: "Institution settings", href: "/admin/institution", comingSoon: true },
        { label: "Knowledge base", href: "/admin/knowledge", comingSoon: true },
        { label: "AI usage & budgets", href: "/admin/ai", comingSoon: true },
        { label: "Audit log", href: "/admin/audit", comingSoon: true },
      ]}
    >
      {children}
    </PortalShell>
  );
}
