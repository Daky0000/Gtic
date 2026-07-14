// Sections 9–11: Non-Functional Requirements, Technical Architecture, Data Model.
import { h1, h2, p, bullet, table, reqBlock, callout, spacer } from "./helpers.mjs";

export const nonFunctional = () => [
  h1("9. Non-Functional Requirements"),

  h2("9.1 Security"),
  ...reqBlock([
    ["NFR-01", "All traffic shall be encrypted in transit (HTTPS/TLS); passwords stored only as strong adaptive hashes; secrets (API keys, gateway credentials) encrypted at rest and never sent to the browser."],
    ["NFR-02", "Access control shall be role-and-permission based (RBAC) and enforced on the server for every request — the UI hiding a button is never the security boundary."],
    ["NFR-03", "The system shall defend against the OWASP Top 10: parameterised queries only, output encoding, CSRF protection, strict input validation (Zod at every boundary), secure session cookies, and security headers (CSP, HSTS)."],
    ["NFR-04", "Privileged roles (Registrar, Finance, System Admin) shall require multi-factor authentication; all users may enable it."],
    ["NFR-05", "Sessions shall expire on inactivity per role policy; concurrent-session limits configurable (SYS-14)."],
    ["NFR-06", "File uploads shall be type-checked, size-limited, virus-scan-ready (hook), stored outside the web root, and served through authorising endpoints only."],
    ["NFR-07", "The audit trail shall be append-only and cover every consequential action (XC-04); log access itself is logged."],
    ["NFR-08", "The system shall rate-limit authentication and public endpoints and lock accounts after repeated failed logins with safe recovery."],
  ]),

  h2("9.2 Data Protection (Ghana Data Protection Act, 2012 — Act 843)"),
  ...reqBlock([
    ["NFR-09", "Personal data shall be collected for stated purposes only, with a plain-language privacy notice shown at account creation and available always (XC-09)."],
    ["NFR-10", "Data subjects shall be able to view the categories of data held about them and request correction through the profile/change-request flows."],
    ["NFR-11", "Retention shall be policy-driven: academic records retained per statutory requirement; ancillary data (e.g. unsuccessful applications) purged on a configurable schedule."],
    ["NFR-12", "Personal data sent to third parties (payment gateway, SMS provider, Anthropic API) shall be the minimum necessary for the function, under documented processor terms; counselling records never leave the system (CNS-03)."],
    ["NFR-13", "A breach-response procedure shall be documented, with the audit and logging design supporting investigation and notification duties."],
  ]),

  h2("9.3 Performance & Capacity"),
  ...reqBlock([
    ["NFR-14", "Interactive pages shall respond in under 2 seconds at the 95th percentile on institutional broadband, and remain usable on 3G-class mobile connections (initial page under ~300KB critical path, images lazy-loaded)."],
    ["NFR-15", "The system shall handle registration-day and results-day spikes (thousands of concurrent students) through queueing of heavy jobs and read-optimised views — with load-test evidence before each such first event."],
    ["NFR-16", "Bulk operations (bill generation, offer issuance, results processing for a semester) shall run as background jobs with progress visibility, never blocking the UI."],
    ["NFR-17", "Capacity target for v1: 20,000 active student accounts, 100,000 applications per cycle, 10 years of records — with headroom documented."],
  ]),

  h2("9.4 Availability & Continuity"),
  ...reqBlock([
    ["NFR-18", "Target availability 99.5% monthly for portals; planned maintenance announced in-app in advance (SYS-10)."],
    ["NFR-19", "Automated daily backups (database + uploaded files) with tested restore runbooks; recovery point objective ≤ 24h, recovery time objective ≤ 4h for v1."],
    ["NFR-20", "The system shall degrade gracefully: if AI, SMS, email or the payment gateway is down, core functions continue and affected features show clear status."],
  ]),

  h2("9.5 Usability & Accessibility"),
  ...reqBlock([
    ["NFR-21", "All portals shall be responsive (phone-first for student/applicant portals) and meet WCAG 2.1 AA basics: contrast, keyboard navigation, labels, focus states."],
    ["NFR-22", "Language shall be plain English throughout; every error message says what happened and what to do next."],
    ["NFR-23", "The design shall be localisation-ready (all strings externalised), though v1 ships English only."],
  ]),

  h2("9.6 Maintainability & Operability"),
  ...reqBlock([
    ["NFR-24", "The codebase shall be a single typed monorepo application with module boundaries, automated tests on critical flows (registration rules, fee gates, results computation, AI service contract) and CI on every change."],
    ["NFR-25", "All environment-specific settings shall come from configuration/environment variables — one build runs everywhere."],
    ["NFR-26", "Structured application logs and health endpoints shall support operation on a plain VPS; deployment is a documented, containerised (Docker) procedure."],
    ["NFR-27", "The institution's data shall be exportable in open formats at any time (SYS-15) — no lock-in."],
  ]),
];

export const technicalArchitecture = () => [
  h1("10. Technical Architecture"),

  h2("10.1 Shape of the System"),
  p([
    "One ", { t: "Next.js (App Router) + TypeScript", b: true },
    " application serves all five portals as route groups — ",
    { t: "(public), (apply), (student), (staff), (admin)", i: true },
    " — sharing a single component library, one authentication system and one database. This deliberately avoids premature micro-service complexity while keeping clean module folders (features/admissions, features/registration, …) that could be split later if ever needed.",
  ]),
  table(
    ["Layer", "Choice", "Why"],
    [
      ["Web framework", "Next.js 15 (App Router), React, TypeScript", "Server components for fast low-bandwidth pages; one stack for UI and API; huge ecosystem"],
      ["Database", "PostgreSQL 16 + Prisma ORM", "Relational integrity for academic/financial records; full-text search for the knowledge base; pgvector-ready"],
      ["Auth & RBAC", "Auth.js (or better-auth) + custom role/permission model", "Sessions, credentials + optional OAuth, MFA; permissions enforced in a single server-side guard layer"],
      ["Validation", "Zod everywhere (forms, API, AI structured outputs)", "One schema definition validates the browser form, the API call and the AI response"],
      ["AI", "Anthropic TypeScript SDK behind AIService", "Section 8"],
      ["Background jobs", "Postgres-backed job queue (e.g. pg-boss)", "Bulk billing, offer issuance, notifications, AI indexing — no extra infrastructure beyond Postgres"],
      ["PDF generation", "Server-side HTML-to-PDF service", "Admission letters, receipts, transcripts, slips from HTML templates with the institution's branding"],
      ["File storage", "Adapter: local disk (default) ↔ S3-compatible", "Runs on a bare VPS; scales to object storage unchanged"],
      ["Payments", "Adapter: Paystack (default) ↔ mock", "Cards + MTN MoMo / Telecel Cash / AT Money; webhook-driven reconciliation"],
      ["Email / SMS", "Adapters: SMTP or Resend / Hubtel or mNotify ↔ mocks", "Ghana-relevant SMS routes; every provider swappable by configuration"],
      ["Deployment", "Docker Compose (app + Postgres + backups)", "Deployable on a local VPS, university data centre or any cloud"],
    ],
    { widths: [16, 34, 50] }
  ),
  spacer(),

  h2("10.2 The Adapter Principle"),
  p("Every external dependency — payments, SMS, email, file storage, AI — sits behind a small interface with at least two implementations: the real provider and a deterministic mock. Development, demos and automated tests run fully offline on mocks; production flips to real providers by configuration. This is also what makes the product genuinely rebrandable and portable between institutions."),

  h2("10.3 Security Architecture (summary)"),
  bullet("Single server-side permission guard consulted by every server action and API route; permissions derived from role assignments with effective dates."),
  bullet("All secrets in encrypted configuration; the browser only ever holds a session cookie."),
  bullet("Uploads stored privately and streamed through authorising endpoints; public documents (letters) exposed only via their verification codes."),
  bullet("Append-only audit writer invoked by the same mutation helpers every module uses — auditing by construction, not by discipline."),

  h2("10.4 Environments"),
  table(
    ["Environment", "Purpose", "Providers"],
    [
      ["Local development", "Feature development", "All mocks; seeded demo data"],
      ["Staging/demo", "Client review, UAT, training", "Mocks or sandbox providers (Paystack test keys); anonymised data"],
      ["Production", "Live operation", "Real providers; backups and monitoring active"],
    ],
    { widths: [22, 34, 44] }
  ),
];

export const dataModel = () => [
  h1("11. Data Model Overview"),
  p("The full physical schema is an implementation artefact; this section fixes the entity groups, key entities and the relationships that matter. Roughly 60–70 tables are expected in v1."),
  table(
    ["Group", "Key entities", "Notes / key relationships"],
    [
      ["Identity & access", "User, Role, Permission, RoleAssignment, Session, AuditLog", "A User may hold many RoleAssignments with effective dates; AuditLog is append-only"],
      ["Institution config", "Institution, BrandingConfig, NumberFormat, PolicyToggle, NotificationTemplate, IntegrationSetting", "The white-label layer; secrets encrypted"],
      ["Academic structure", "School, Department, Programme, CurriculumVersion, CurriculumCourse, Course, Prerequisite", "Programme → many CurriculumVersions (by entry year); CurriculumCourse fixes semester/core-elective per version"],
      ["Calendar", "AcademicYear, Semester, Window (registration/add-drop/booking/evaluation), KeyDate", "Every date-gated behaviour reads from here (XC-10)"],
      ["Admissions", "AdmissionCycle, CycleProgramme (quota), Application, ApplicationDocument, EntryRequirementRule, Decision, Offer, Voucher, ApplicantMessage", "Application → Decision → Offer → (on acceptance) Student"],
      ["People", "ApplicantProfile, Student, StudentStatusHistory, StaffMember, Appointment", "Student links back to its originating Application; Appointment drives role assignment"],
      ["Registration", "CourseOffering, OfferingLecturer, Registration, RegistrationCourse, AddDropRecord", "Registration validated against CurriculumVersion, credits, prerequisites, fee gate"],
      ["Assessment & results", "AssessmentStructure, GradeSheet, GradeEntry, ApprovalStep, SemesterResult, CumulativeStanding, Transcript, RemarkCase, MalpracticeCase, Amendment", "GradeSheet carries the approval chain; Amendment preserves prior values"],
      ["Finance", "FeeSchedule, FeeItem, Invoice, InvoiceLine, Payment, Receipt, TellerSubmission, Exception (plan/waiver/scholarship), Sponsor, PeriodClose", "Payment ↔ Invoice matching; gates computed from Invoice vs Payment totals"],
      ["Accommodation", "Hostel, Block, Room, Bed, BookingWindow, Booking, Allocation, ResidencyRecord, MaintenanceTicket", "Booking auto-raises a hostel Invoice; unpaid bookings expire"],
      ["E-learning", "CourseSpace, Material, Assignment, Submission, Quiz, QuizQuestion, QuizAttempt, AttendanceSession, AttendanceRecord", "CourseSpace 1:1 with CourseOffering; rosters derive from Registration"],
      ["Library", "BibRecord, ItemCopy, Loan, Hold, Fine, EResourceLink", "Membership derives from Student/Staff status"],
      ["HR", "LeaveType, LeaveApplication, LeaveBalance, AppraisalCycle, AppraisalRecord, DirectoryEntry", "StaffMember owned in People group"],
      ["Timetabling", "Venue, TimeSlot, TeachingSession, ExamSession, InvigilationAssignment", "Clash detection across student registrations, lecturers, venues"],
      ["Communications", "Announcement, Campaign, AudienceSegment, DeliveryLog, NotificationPreference, Notification", "Statutory vs marketing distinction respected"],
      ["Documents & requests", "DocumentRequest, IssuedDocument, VerificationCheck", "IssuedDocument holds the public verification code"],
      ["Graduate studies", "Candidature, SupervisionAssignment, Milestone, MilestoneSubmission, ExaminerPanel, ExaminerReport, ThesisRecord", "Milestones advance by approval only"],
      ["Alumni", "AlumniProfile, Donation, AlumniEvent, EventRegistration", "Created automatically at conferral"],
      ["AI", "KnowledgeDocument, KnowledgeChunk, AIConversation, AIMessage, AIAuditLog, AIUsageMetric, AIFeatureConfig", "AIFeatureConfig: enabled flag, model, effort, monthly budget per feature"],
    ],
    { widths: [16, 38, 46] }
  ),
  spacer(),
  callout("DESIGN RULES", "Every table carries created/updated timestamps and actor IDs. Soft deletion only where the domain requires recoverability; academic and financial records are never hard-deleted. All cross-module reads go through module service functions, not ad-hoc joins, to keep boundaries intact."),
];
