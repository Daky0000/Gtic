"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/portal-shell";

export function SidebarNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();

  // Pick the single best-matching item (longest href that the path is under)
  // so a portal root like "/staff" doesn't stay lit on every sub-page.
  const activeHref = nav.reduce<string | null>((best, item) => {
    if (item.comingSoon) return best;
    const matches = pathname === item.href || pathname.startsWith(item.href + "/");
    if (matches && item.href.length > (best?.length ?? -1)) return item.href;
    return best;
  }, null);

  return (
    <div className="flex flex-col gap-0.5">
      {nav.map((item) =>
        item.comingSoon ? (
          <span
            key={item.label}
            title="Coming in a later phase"
            className="flex items-center gap-[11px] rounded-[10px] px-[13px] py-[10px] text-sm text-faint/70"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-line" />
            <span className="flex-1">{item.label}</span>
            <span className="font-mono text-[9px] uppercase tracking-wide">soon</span>
          </span>
        ) : (
          <Link
            key={item.label}
            href={item.href}
            aria-current={activeHref === item.href ? "page" : undefined}
            className={
              activeHref === item.href
                ? "flex items-center gap-[11px] rounded-[10px] bg-forest px-[13px] py-[10px] text-sm font-medium text-white"
                : "flex items-center gap-[11px] rounded-[10px] px-[13px] py-[10px] text-sm text-muted transition-colors hover:bg-[#eaf0ea] hover:text-forest"
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${activeHref === item.href ? "bg-[#a9c7b2]" : "bg-line"}`}
            />
            {item.label}
          </Link>
        )
      )}
    </div>
  );
}
