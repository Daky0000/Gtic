import { isDeveloper, requirePortal } from "@/lib/rbac";
import { getHiddenFeatureKeys, visibleNav } from "@/lib/feature-flags";
import { PortalShell } from "@/components/portal-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("student");
  const hidden = await getHiddenFeatureKeys();
  const nav = visibleNav(
    [
      { label: "Dashboard", href: "/student" },
      { label: "My profile", href: "/student/profile" },
      { label: "Course registration", href: "/student/registration" },
      { label: "Timetable", href: "/student/timetable" },
      { label: "Results", href: "/student/results" },
      { label: "Transcript", href: "/student/transcript" },
      { label: "Fees & payments", href: "/student/fees" },
      { label: "Accommodation", href: "/student/accommodation" },
      { label: "E-learning", href: "/student/elearning" },
      { label: "Requests", href: "/student/requests" },
      { label: "My candidature", href: "/student/candidature" },
    ],
    hidden,
    isDeveloper(user)
  );
  return (
    <PortalShell portalName="Student Portal" user={user} nav={nav}>
      {children}
    </PortalShell>
  );
}
