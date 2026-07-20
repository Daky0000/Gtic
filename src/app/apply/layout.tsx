import { isDeveloper, requirePortal } from "@/lib/rbac";
import { getHiddenFeatureKeys, visibleNav } from "@/lib/feature-flags";
import { PortalShell } from "@/components/portal-shell";

export default async function ApplyLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("apply");
  const hidden = await getHiddenFeatureKeys();
  const nav = visibleNav(
    [
      { label: "Overview", href: "/apply" },
      { label: "My application", href: "/apply/application" },
      { label: "Documents", href: "/apply/documents" },
      { label: "Payments", href: "/apply/payments" },
      { label: "Admission letter", href: "/apply/letter" },
    ],
    hidden,
    isDeveloper(user)
  );
  return (
    <PortalShell portalName="Applicant Portal" user={user} nav={nav}>
      {children}
    </PortalShell>
  );
}
