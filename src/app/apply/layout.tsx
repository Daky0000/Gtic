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
        { label: "My application", href: "/apply/application" },
        { label: "Documents", href: "/apply/documents" },
        { label: "Payments", href: "/apply/payments" },
        { label: "Admission letter", href: "/apply/letter" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
