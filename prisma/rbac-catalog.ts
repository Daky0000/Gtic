// Single source of truth for the role/permission catalog and the demo/testing
// account conventions — shared by the full demo seed (seed.ts) and the
// production account bootstrap (create-demo-users.ts) so the two can never
// drift apart.

/** The single bootstrapped account: a developer user holding EVERY role, for
 * exercising all portals during testing before roles are divided across real
 * staff (per project decision 2026-07-17 — no more per-role demo users). */
export const DEVELOPER_EMAIL = "developer@demo.campuscore.test";

/** All demo/testing accounts live on this domain, one per role. */
export const DEMO_EMAIL_DOMAIN = "demo.campuscore.test";

export function demoEmailForRole(roleCode: string): string {
  return `${roleCode.replace(/_/g, ".")}@${DEMO_EMAIL_DOMAIN}`;
}

/** One simple shared password for every testing account (per project decision
 * 2026-07-17: simpler beats per-role). These are TESTING credentials — change
 * them in-app before any real data enters the system (env-var overrides were
 * removed 2026-07-18; see bootstrap-accounts.ts). Must stay ≥ 8 chars:
 * seed.ts creates users through the better-auth signup API, which enforces
 * the minimum length. */
export const DEMO_SHARED_PASSWORD = "gtic1234";

export function demoPasswordForRole(_roleCode: string): string {
  return DEMO_SHARED_PASSWORD;
}

/** Default password for the all-roles developer user. */
export const DEVELOPER_PASSWORD = DEMO_SHARED_PASSWORD;

export const ROLES: [code: string, name: string][] = [
  ["applicant", "Prospective Applicant"],
  ["student", "Trainee"],
  ["lecturer", "Instructor"],
  ["hod", "Head of Department"],
  ["dean", "Dean of School"],
  ["admissions_officer", "Admissions Officer"],
  ["registrar", "Registrar / Academic Affairs"],
  ["exams_officer", "Assessments Officer"],
  ["finance_officer", "Finance Officer"],
  ["accommodation_manager", "Accommodation Manager"],
  ["librarian", "Librarian"],
  ["hr_officer", "HR Officer"],
  ["grad_school_officer", "Graduate School Officer"],
  ["counsellor", "Counsellor / Trainee Affairs"],
  ["qa_officer", "Quality Assurance Officer"],
  ["management", "Center Management"],
  ["alumni", "Alumnus/Alumna"],
  ["system_admin", "System Administrator"],
  ["developer", "Developer / Super Administrator"],
];

export const PERMISSIONS: [code: string, name: string, module: string][] = [
  ["admin.access", "Access the administration portal", "system"],
  ["users.manage", "Manage users and role assignments", "system"],
  ["institution.configure", "Configure institution identity and settings", "system"],
  ["knowledge.manage", "Manage the AI knowledge base", "ai"],
  ["ai.configure", "Configure AI features and budgets", "ai"],
  ["audit.view", "View the audit log", "system"],
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  developer: PERMISSIONS.map(([code]) => code),
  system_admin: PERMISSIONS.map(([code]) => code),
  registrar: ["knowledge.manage", "audit.view"],
  management: ["audit.view"],
};
