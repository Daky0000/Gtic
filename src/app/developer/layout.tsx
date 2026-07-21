import { requirePortal } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";

export default async function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("developer");
  return (
    <PortalShell
      portalName="Developer Console"
      user={user}
      nav={[
        { label: "Overview", href: "/developer" },
        { label: "Fees & pricing", href: "/developer/fees" },
        { label: "System settings", href: "/developer/settings" },
        { label: "Feature visibility", href: "/developer/features" },
        // The developer also owns the shared admin console pages — linked
        // here so everything is reachable from one place.
        { label: "Users & roles", href: "/admin/users" },
        { label: "Forms", href: "/admin/forms" },
        { label: "Media library", href: "/admin/media" },
        { label: "Audit log", href: "/admin/audit" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
