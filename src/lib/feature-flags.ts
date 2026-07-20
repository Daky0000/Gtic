import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Portal } from "@/lib/rbac";

/**
 * Developer-controlled visibility of portals and portal menu items.
 * A FeatureFlag row's presence means that key is hidden; the key encodes
 * either a whole portal ("portal:<portal>") or a single nav item
 * ("nav:<href>"). Hiding a portal blocks entry for everyone except the
 * developer role (enforced in requirePortal, src/lib/rbac.ts); hiding a nav
 * item only removes it from the sidebar — the page stays reachable by direct
 * URL, same as any other page without a dedicated permission guard.
 */

export function portalFlagKey(portal: Portal): string {
  return `portal:${portal}`;
}

export function navFlagKey(href: string): string {
  return `nav:${href}`;
}

export const getHiddenFeatureKeys = cache(async (): Promise<Set<string>> => {
  const rows = await db.featureFlag.findMany({ select: { key: true } });
  return new Set(rows.map((r) => r.key));
});

export function isPortalHidden(hidden: Set<string>, portal: Portal): boolean {
  return hidden.has(portalFlagKey(portal));
}

/** Filters a nav array down to visible items. Pass `isDev: true` to skip
 * filtering entirely — the developer role always sees every portal and menu
 * so it can always reach /developer/features to undo a hide. */
export function visibleNav<T extends { href: string }>(
  nav: T[],
  hidden: Set<string>,
  isDev: boolean
): T[] {
  if (isDev) return nav;
  return nav.filter((item) => !hidden.has(navFlagKey(item.href)));
}

export function isKnownFeatureKey(key: string): boolean {
  if (HIDEABLE_PORTALS.some((p) => portalFlagKey(p.portal) === key)) return true;
  return HIDEABLE_NAV.some((g) => g.items.some((i) => navFlagKey(i.href) === key));
}

export async function setFeatureHidden(key: string, hidden: boolean, actorId: string) {
  if (hidden) {
    await db.featureFlag.upsert({
      where: { key },
      update: { updatedById: actorId },
      create: { key, updatedById: actorId },
    });
  } else {
    await db.featureFlag.deleteMany({ where: { key } });
  }
  await audit({
    actorId,
    action: hidden ? "system.feature_hidden" : "system.feature_shown",
    entityType: "FeatureFlag",
    entityId: key,
  });
}

// ─── Static registry: everything the developer console can toggle ───
// Mirrors the nav arrays defined in each portal's layout.tsx. Keep this in
// sync when a layout's nav changes — this list only drives the toggle UI;
// each layout filters its own nav independently via `visibleNav` above, so a
// stale registry entry would only make the console UI incomplete, not break
// enforcement.

export const HIDEABLE_PORTALS: { portal: Exclude<Portal, "developer">; label: string }[] = [
  { portal: "apply", label: "Applicant Portal" },
  { portal: "student", label: "Student Portal" },
  { portal: "staff", label: "Staff Portal" },
  { portal: "admin", label: "Administration" },
];

export const HIDEABLE_NAV: {
  portal: Exclude<Portal, "developer">;
  portalLabel: string;
  items: { label: string; href: string }[];
}[] = [
  {
    portal: "apply",
    portalLabel: "Applicant Portal",
    items: [
      { label: "Overview", href: "/apply" },
      { label: "My application", href: "/apply/application" },
      { label: "Documents", href: "/apply/documents" },
      { label: "Payments", href: "/apply/payments" },
      { label: "Admission letter", href: "/apply/letter" },
    ],
  },
  {
    portal: "student",
    portalLabel: "Student Portal",
    items: [
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
  },
  {
    portal: "staff",
    portalLabel: "Staff Portal",
    items: [
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
  },
  {
    portal: "admin",
    portalLabel: "Administration",
    items: [
      { label: "Overview", href: "/admin" },
      { label: "Academic calendar", href: "/admin/calendar" },
      { label: "Users & roles", href: "/admin/users" },
      { label: "Forms", href: "/admin/forms" },
      { label: "Audit log", href: "/admin/audit" },
    ],
  },
];
