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
        { label: "My courses", href: "/staff/courses", comingSoon: true },
        { label: "Grading", href: "/staff/grading", comingSoon: true },
        { label: "Approvals", href: "/staff/approvals", comingSoon: true },
        { label: "Admissions review", href: "/staff/admissions", comingSoon: true },
        { label: "Reports", href: "/staff/reports", comingSoon: true },
      ]}
    >
      {children}
    </PortalShell>
  );
}
