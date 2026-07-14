import { requirePortal } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";

export default async function ApplyLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("apply");
  return (
    <PortalShell
      portalName="Applicant Portal"
      user={user}
      nav={[
        { label: "Overview", href: "/apply" },
        { label: "My application", href: "/apply/application", comingSoon: true },
        { label: "Documents", href: "/apply/documents", comingSoon: true },
        { label: "Payments", href: "/apply/payments", comingSoon: true },
        { label: "Messages", href: "/apply/messages", comingSoon: true },
      ]}
    >
      {children}
    </PortalShell>
  );
}
