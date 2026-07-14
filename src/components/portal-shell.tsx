import Link from "next/link";
import type { CurrentUser } from "@/lib/rbac";
import { SignOutButton } from "@/components/sign-out-button";
import { AssistantPanel } from "@/components/chat/assistant-panel";

export type NavItem = {
  label: string;
  href: string;
  /** Items not yet built in the current phase render as disabled. */
  comingSoon?: boolean;
};

export function PortalShell({
  portalName,
  accent = "brand",
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
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-300/60 bg-white md:flex">
        <div className="border-b border-ink-300/60 px-5 py-4">
          <Link href="/" className="block">
            <span className="text-lg font-bold text-brand-800">CampusCore</span>
          </Link>
          <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-ink-500">
            {portalName}
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) =>
            item.comingSoon ? (
              <span
                key={item.label}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-ink-300"
                title="Coming in a later phase"
              >
                {item.label}
                <span className="text-[10px] uppercase">soon</span>
              </span>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-800"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
        <div className="border-t border-ink-300/60 p-3 text-xs text-ink-500">
          Signed in as
          <div className="truncate font-medium text-ink-700">{user.email}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-300/60 bg-white px-4 py-3 md:px-6">
          <div className="md:hidden">
            <span className="font-bold text-brand-800">CampusCore</span>
            <span className="ml-2 text-xs uppercase text-ink-500">{portalName}</span>
          </div>
          <div className="hidden text-sm text-ink-500 md:block">{portalName}</div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-700 sm:block">{user.name}</span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      {/* Floating AI assistant, available in every portal */}
      <AssistantPanel />
    </div>
  );
}
