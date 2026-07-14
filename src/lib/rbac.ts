import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── Role catalog (codes are stable identifiers; display names live in DB) ───
export const ROLES = {
  APPLICANT: "applicant",
  STUDENT: "student",
  LECTURER: "lecturer",
  HOD: "hod",
  DEAN: "dean",
  ADMISSIONS_OFFICER: "admissions_officer",
  REGISTRAR: "registrar",
  EXAMS_OFFICER: "exams_officer",
  FINANCE_OFFICER: "finance_officer",
  ACCOMMODATION_MANAGER: "accommodation_manager",
  LIBRARIAN: "librarian",
  HR_OFFICER: "hr_officer",
  GRAD_SCHOOL_OFFICER: "grad_school_officer",
  COUNSELLOR: "counsellor",
  QA_OFFICER: "qa_officer",
  MANAGEMENT: "management",
  ALUMNI: "alumni",
  SYSTEM_ADMIN: "system_admin",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

const STAFF_ROLES: RoleCode[] = [
  ROLES.LECTURER, ROLES.HOD, ROLES.DEAN, ROLES.ADMISSIONS_OFFICER,
  ROLES.REGISTRAR, ROLES.EXAMS_OFFICER, ROLES.FINANCE_OFFICER,
  ROLES.ACCOMMODATION_MANAGER, ROLES.LIBRARIAN, ROLES.HR_OFFICER,
  ROLES.GRAD_SCHOOL_OFFICER, ROLES.COUNSELLOR, ROLES.QA_OFFICER,
  ROLES.MANAGEMENT,
];

// Which roles may enter which portal (route group).
export const PORTAL_ACCESS: Record<Portal, RoleCode[]> = {
  apply: [ROLES.APPLICANT],
  student: [ROLES.STUDENT, ROLES.ALUMNI],
  staff: STAFF_ROLES,
  admin: [ROLES.SYSTEM_ADMIN, ROLES.MANAGEMENT, ROLES.REGISTRAR],
};

export type Portal = "apply" | "student" | "staff" | "admin";

// Preferred landing portal when a user holds several roles.
const PORTAL_PRIORITY: Portal[] = ["admin", "staff", "student", "apply"];

export function homePortalFor(roles: string[]): Portal | null {
  for (const portal of PORTAL_PRIORITY) {
    if (PORTAL_ACCESS[portal].some((r) => roles.includes(r))) return portal;
  }
  return null;
}

/** All portals a set of roles may enter — powers the portal switcher for
 * multi-role accounts (e.g. the testing super user holding every role). */
export function accessiblePortals(roles: string[]): Portal[] {
  return PORTAL_PRIORITY.filter((p) => PORTAL_ACCESS[p].some((r) => roles.includes(r)));
}

export const PORTAL_HOME: Record<Portal, string> = {
  apply: "/apply",
  student: "/student",
  staff: "/staff",
  admin: "/admin",
};

// ─── Session + roles (deduped per request via React cache) ───

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  roles: RoleCode[];
  permissions: string[];
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const now = new Date();
  const assignments = await db.roleAssignment.findMany({
    where: {
      userId: session.user.id,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  const roles = [...new Set(assignments.map((a) => a.role.code))] as RoleCode[];
  const permissions = [
    ...new Set(assignments.flatMap((a) => a.role.permissions.map((p) => p.permission.code))),
  ];

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles,
    permissions,
  };
});

// ─── Guards (server components / actions / route handlers) ───

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePortal(portal: Portal): Promise<CurrentUser> {
  const user = await requireUser();
  if (!PORTAL_ACCESS[portal].some((r) => user.roles.includes(r))) {
    const home = homePortalFor(user.roles);
    redirect(home ? PORTAL_HOME[home] : "/login");
  }
  return user;
}

export async function requirePermission(code: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.includes(code)) {
    throw new Error(`Forbidden: missing permission "${code}"`);
  }
  return user;
}

export function hasRole(user: CurrentUser, ...roles: RoleCode[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}

/** Used inside server actions/mutations — throws (rather than redirects) so
 * the calling form surfaces a clear error instead of a silent navigation. */
export async function requireRole(...roles: RoleCode[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user, ...roles)) {
    throw new Error(`Forbidden: requires role ${roles.join(" or ")}`);
  }
  return user;
}

/** Non-redirecting variant for API routes: returns null when unauthenticated. */
export async function getApiUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}
