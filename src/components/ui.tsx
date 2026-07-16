import Link from "next/link";
import type { ReactNode } from "react";

/* ============================================================
   Shared portal UI primitives — the SYDA-GTIC editorial look.
   Server-component friendly (no client hooks).
   ============================================================ */

/** Uppercase monospace eyebrow/section label. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[11px] uppercase tracking-[0.08em] text-faint ${className}`}>
      {children}
    </div>
  );
}

/** Page header: serif title (children may include <em> for the forest accent),
 *  optional lead paragraph and a right-aligned action slot. */
export function PageHeader({
  title,
  lead,
  action,
}: {
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-[30px] font-normal leading-[1.1] text-ink md:text-[32px]">
          {title}
        </h1>
        {lead && <p className="mt-1.5 max-w-[640px] text-[15px] leading-[1.6] text-muted">{lead}</p>}
      </div>
      {action && <div className="flex flex-shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Warm paper card. */
export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return <Tag className={`card p-6 ${className}`}>{children}</Tag>;
}

/** Small mono label used as a card heading. */
export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
      {children}
    </div>
  );
}

export type ChipTone = "green" | "amber" | "sky" | "violet" | "neutral";

const CHIP: Record<ChipTone, string> = {
  green: "text-forest bg-[#e4eee6]",
  amber: "text-[#a85a2e] bg-[#f3e3d6]",
  sky: "text-[#2e6f86] bg-[#deebf0]",
  violet: "text-[#5b4a86] bg-[#e7e2f2]",
  neutral: "text-muted bg-line-soft",
};

/** Status pill. */
export function StatusChip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-[11px] py-1 text-[12px] font-semibold ${CHIP[tone]}`}>
      {children}
    </span>
  );
}

/** Big serif stat tile. */
export function Stat({
  n,
  label,
  sub,
  tint,
}: {
  n: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  tint?: string;
}) {
  return (
    <div className="card p-5">
      {tint && <div className="mb-4 h-1.5 w-[30px] rounded-full" style={{ background: tint }} />}
      <div className="font-serif text-[34px] leading-none text-ink">{n}</div>
      <div className="mt-2 text-[13px] text-ink">{label}</div>
      {sub && <div className="mt-0.5 text-[12px] text-faint">{sub}</div>}
    </div>
  );
}

/** Forest pill button that is a link. */
export function ButtonLink({
  href,
  children,
  variant = "forest",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "forest" | "outline";
  className?: string;
}) {
  const base =
    variant === "forest"
      ? "btn-forest px-5 py-2.5 text-[14px]"
      : "btn-outline px-5 py-2.5 text-[14px]";
  return (
    <Link href={href} className={`${base} ${className}`}>
      {children}
    </Link>
  );
}

/** Empty-state block. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="card p-8 text-center text-sm text-muted">{children}</div>
  );
}
