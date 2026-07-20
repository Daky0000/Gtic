import Link from "next/link";
import { db } from "@/lib/db";
import { accessiblePortals, isDeveloper, PORTAL_HOME, type CurrentUser } from "@/lib/rbac";
import { getHiddenFeatureKeys } from "@/lib/feature-flags";
import { SignOutButton } from "@/components/sign-out-button";
import { AssistantPanel } from "@/components/chat/assistant-panel";
import { NotificationsBell } from "@/components/notifications-bell";
import { SidebarNav } from "@/components/sidebar-nav";
import { OpenAssistantButton } from "@/components/open-assistant-button";

const PORTAL_LABEL: Record<string, string> = {
  developer: "Developer",
  apply: "Applicant",
  student: "Student",
  staff: "Instructor",
  admin: "Admin",
};

export type NavItem = {
  label: string;
  href: string;
  /** Items not yet built in the current phase render as disabled. */
  comingSoon?: boolean;
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

export async function PortalShell({
  portalName,
  nav,
  user,
  children,
}: {
  portalName: string;
  accent?: string;
  nav: NavItem[];
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const dev = isDeveloper(user);
  const [institution, recent, unreadCount, hidden] = await Promise.all([
    db.institution.findFirst(),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    dev ? Promise.resolve(new Set<string>()) : getHiddenFeatureKeys(),
  ]);
  const shortName = institution?.shortName ?? "SYDA·GTIC";
  const bellItems = recent.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));
  const userInitial = initials(user.name);
  const portals = accessiblePortals(user.roles, hidden);
  // Derive the active portal from the nav's own hrefs (e.g. "/staff/..." → "staff").
  const currentPortal = nav[0]?.href.split("/")[1] ?? "";

  return (
    <div className="flex min-h-screen bg-cream text-ink">
      {/* ===== Sidebar ===== */}
      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col border-r border-line bg-paper md:flex">
        <div className="border-b border-line-soft px-[22px] pb-[18px] pt-[22px]">
          <Link href="/" className="flex items-center gap-[10px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest font-mono text-[12px] text-white">
              S
            </span>
            <span className="font-mono text-[12px] uppercase tracking-[0.1em]">
              SYDA<span className="text-faint">·</span>GTIC
            </span>
          </Link>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-moss">
            {portalName}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {portals.length > 1 && (
            <div className="mb-4 border-b border-line-soft pb-4">
              <div className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                Portals
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {portals.map((p) => {
                  const active = p === currentPortal;
                  return (
                    <Link
                      key={p}
                      href={PORTAL_HOME[p]}
                      aria-current={active ? "page" : undefined}
                      className={
                        active
                          ? "rounded-[10px] bg-forest px-3 py-2 text-center text-[12px] font-medium text-white"
                          : "rounded-[10px] border border-line bg-paper px-3 py-2 text-center text-[12px] text-muted transition-colors hover:border-forest hover:text-forest"
                      }
                    >
                      {PORTAL_LABEL[p] ?? p}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <SidebarNav nav={nav} />
          <div className="mt-4 border-t border-line-soft pt-4">
            <OpenAssistantButton />
          </div>
        </div>

        <div className="border-t border-line-soft p-3">
          <div className="flex items-center gap-[10px] px-1.5 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-moss text-[13px] font-semibold text-white">
              {userInitial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-ink">{user.name}</div>
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-[18px] border-b border-line bg-cream/85 px-4 py-4 backdrop-blur-md md:px-8">
          <div className="md:hidden">
            <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-forest">
              {shortName}
            </span>
          </div>
          <div className="hidden font-serif text-[22px] text-ink md:block">{portalName}</div>
          <div className="flex-1" />
          <div className="flex items-center gap-[14px]">
            {portals.length > 1 && (
              <div className="hidden gap-1 rounded-full border border-line bg-paper p-1 lg:flex">
                {portals.map((p) => (
                  <Link
                    key={p}
                    href={PORTAL_HOME[p]}
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-cream hover:text-forest"
                  >
                    {PORTAL_LABEL[p] ?? p}
                  </Link>
                ))}
              </div>
            )}
            <NotificationsBell notifications={bellItems} unreadCount={unreadCount} />
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-moss text-[13px] font-semibold text-white">
              {userInitial}
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-[1080px]">{children}</div>
        </main>
      </div>

      {/* Floating AI assistant, available in every portal */}
      <AssistantPanel />
    </div>
  );
}
