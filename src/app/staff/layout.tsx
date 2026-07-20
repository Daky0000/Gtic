import { isDeveloper, requirePortal } from "@/lib/rbac";
import { getHiddenFeatureKeys, visibleNav } from "@/lib/feature-flags";
import { PortalShell } from "@/components/portal-shell";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("staff");
  const hidden = await getHiddenFeatureKeys();
  const nav = visibleNav(
    [
      { label: "Dashboard", href: "/staff" },
      { label: "My courses", href: "/staff/courses" },
      { label: "Approvals", href: "/staff/approvals" },
      { label: "Admissions review", href: "/staff/admissions" },
      { label: "Registrations", href: "/staff/registrations" },
      { label: "Short courses", href: "/staff/short-courses" },
      { label: "Enrollment", href: "/staff/enrollment" },
      { label: "Finance", href: "/staff/finance" },
      { label: "Accommodation", href: "/staff/accommodation" },
      { label: "Documents", href: "/staff/documents" },
      { label: "Announcements", href: "/staff/announcements" },
      { label: "Library", href: "/staff/library" },
      { label: "HR", href: "/staff/hr" },
      { label: "Timetable", href: "/staff/timetable" },
      { label: "Graduate studies", href: "/staff/graduate" },
      { label: "Reports", href: "/staff/reports" },
    ],
    hidden,
    isDeveloper(user)
  );
  return (
    <PortalShell portalName="Staff Portal" user={user} nav={nav}>
      {children}
    </PortalShell>
  );
}
