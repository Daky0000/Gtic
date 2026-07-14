import { requirePortal } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("staff");
  return (
    <PortalShell
      portalName="Staff Portal"
      user={user}
      nav={[
        { label: "Dashboard", href: "/staff" },
        { label: "My courses", href: "/staff/courses" },
        { label: "Approvals", href: "/staff/approvals" },
        { label: "Admissions review", href: "/staff/admissions" },
        { label: "Enrollment", href: "/staff/enrollment" },
        { label: "Finance", href: "/staff/finance" },
        { label: "Reports", href: "/staff/reports", comingSoon: true },
      ]}
    >
      {children}
    </PortalShell>
  );
}
