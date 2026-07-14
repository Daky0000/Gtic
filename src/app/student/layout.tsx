import { requirePortal } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("student");
  return (
    <PortalShell
      portalName="Student Portal"
      user={user}
      nav={[
        { label: "Dashboard", href: "/student" },
        { label: "My profile", href: "/student/profile" },
        { label: "Course registration", href: "/student/registration" },
        { label: "Results", href: "/student/results" },
        { label: "Transcript", href: "/student/transcript" },
        { label: "Fees & payments", href: "/student/fees" },
        { label: "Accommodation", href: "/student/accommodation" },
        { label: "E-learning", href: "/student/elearning", comingSoon: true },
        { label: "Requests", href: "/student/requests", comingSoon: true },
      ]}
    >
      {children}
    </PortalShell>
  );
}
