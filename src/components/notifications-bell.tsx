"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { markAllNotificationsRead } from "@/lib/actions/notifications";

export type BellNotification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: BellNotification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      startTransition(() => markAllNotificationsRead());
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative rounded-full border border-line bg-paper p-2 text-muted transition-colors hover:border-forest hover:text-forest"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-paper shadow-xl"
        >
          <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            Notifications
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted">Nothing here yet.</p>
            )}
            {notifications.map((n) => {
              const inner = (
                <div className={`border-b border-line-soft px-4 py-3 ${!n.readAt ? "bg-[#eaf0ea]/60" : ""}`}>
                  <div className="text-sm font-medium text-ink">{n.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{n.body}</div>
                  <div className="mt-1 font-mono text-[10px] text-faint">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="block hover:bg-cream">
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
