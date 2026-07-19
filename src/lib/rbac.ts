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
  /** Super administrator of the entire system: passes every role and
   * permission check, enters every portal, and owns the developer console
   * (system settings, integrations, fees, users & roles). */
  DEVELOPER: "developer",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

const STAFF_ROLES: RoleCode[] = [
  ROLES.LECTURER, ROLES.HOD, ROLES.DEAN, ROLES.ADMISSIONS_OFFICER,
  ROLES.REGISTRAR, ROLES.EXAMS_OFFICER, ROLES.FINANCE_OFFICER,
  ROLES.ACCOMMODATION_MANAGER, ROLES.LIBRARIAN, ROLES.HR_OFFICER,
  ROLES.GRAD_SCHOOL_OFFICER, ROLES.COUNSELLOR, ROLES.QA_OFFICER,
  ROLES.MANAGEMENT,
];

// Which roles may enter which portal (route group). The developer portal is
// the developer's alone — the system console (pricing, plumbing, oversight)
// as distinct from the admin portal's institutional administration.
export const PORTAL_ACCESS: Record<Portal, RoleCode[]> = {
  developer: [ROLES.DEVELOPER],
  apply: [ROLES.APPLICANT, ROLES.DEVELOPER],
  student: [ROLES.STUDENT, ROLES.ALUMNI, ROLES.DEVELOPER],
  staff: [...STAFF_ROLES, ROLES.DEVELOPER],
  admin: [ROLES.SYSTEM_ADMIN, ROLES.MANAGEMENT, ROLES.REGISTRAR, ROLES.DEVELOPER],
};

export type Portal = "developer" | "apply" | "student" | "staff" | "admin";

// Preferred landing portal when a user holds several roles.
const PORTAL_PRIORITY: Portal[] = ["developer", "admin", "staff", "student", "apply"];

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
  developer: "/developer",
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

/** Redirects to the user's portal home with a visible error message. Thrown
 * plain Errors are masked by Next.js in production server actions (the user
 * would only see a generic digest), so expected authz failures redirect. */
function denied(user: CurrentUser, message: string): never {
  const home = homePortalFor(user.roles);
  const base = home ? PORTAL_HOME[home] : "/login";
  redirect(`${base}?error=${encodeURIComponent(message)}`);
}

export async function requirePermission(code: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.roles.includes(ROLES.DEVELOPER) && !user.permissions.includes(code)) {
    denied(user, "You do not have permission to perform that action.");
  }
  return user;
}

export function hasRole(user: CurrentUser, ...roles: RoleCode[]): boolean {
  // The developer role is a superset — it satisfies every role check.
  if (user.roles.includes(ROLES.DEVELOPER)) return true;
  return roles.some((r) => user.roles.includes(r));
}

/** Used inside server actions/mutations — sends the user back to their portal
 * home with a visible "no permission" message on failure. */
export async function requireRole(...roles: RoleCode[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user, ...roles)) {
    denied(user, "Your account does not have the required role for that action.");
  }
  return user;
}

/** Page guard for the developer console (/admin/settings, /admin/users,
 * /admin/audit): developer or system admin only — other admin portal roles
 * (registrar, management) are bounced to the admin overview. */
export async function requireDeveloperConsole(): Promise<CurrentUser> {
  const user = await requirePortal("admin");
  if (!hasRole(user, ROLES.SYSTEM_ADMIN)) redirect(PORTAL_HOME.admin);
  return user;
}

/** True only when the account actually holds the developer role — unlike
 * hasRole, which treats developer as a superset of every other role. */
export function isDeveloper(user: CurrentUser): boolean {
  return user.roles.includes(ROLES.DEVELOPER);
}

/** Page/action guard for the developer portal (and its pricing console):
 * the developer ONLY. The system admin keeps the admin console but pricing
 * and system plumbing are a developer decision. */
export async function requireFeesConsole(): Promise<CurrentUser> {
  return requirePortal("developer");
}

/** Non-redirecting variant for API routes: returns null when unauthenticated. */
export async function getApiUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}
