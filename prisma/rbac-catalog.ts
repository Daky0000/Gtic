// Single source of truth for the role/permission catalog and the demo/testing
// account conventions — shared by the full demo seed (seed.ts) and the
// production account bootstrap (create-demo-users.ts) so the two can never
// drift apart.

/** One account holding EVERY role — for exercising the whole system during
 * testing before roles are divided across real staff (per project decision). */
export const SUPER_USER_EMAIL = "super@demo.campuscore.test";

/** All demo/testing accounts live on this domain, one per role. */
export const DEMO_EMAIL_DOMAIN = "demo.campuscore.test";

export function demoEmailForRole(roleCode: string): string {
  return `${roleCode.replace(/_/g, ".")}@${DEMO_EMAIL_DOMAIN}`;
}

/** Shared password for testing accounts. Overridable per deployment via the
 * DEMO_PASSWORD env var (and ADMIN_PASSWORD for the super user). */
export const DEFAULT_DEMO_PASSWORD = "Password123!";

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
