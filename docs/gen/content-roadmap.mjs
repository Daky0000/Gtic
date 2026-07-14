// Sections 12–13: Implementation Roadmap, Risks/Assumptions/Glossary.
import { h1, h2, p, bullet, table, callout, spacer } from "./helpers.mjs";

// Phase block helper.
const phase = (num, name, objective, tasks, deliverables, acceptance) => [
  h2(`Phase ${num} — ${name}`),
  p([{ t: "Objective. ", b: true }, objective]),
  p([{ t: "Key tasks:", b: true }]),
  ...tasks.map((t) => bullet(t)),
  p([{ t: "Deliverables: ", b: true }, deliverables]),
  p([{ t: "Done when (acceptance): ", b: true }, acceptance]),
];

export const roadmap = () => [
  h1("12. Implementation Roadmap — Phase by Phase"),
  p("Twelve phases, each independently valuable and verifiable by running the application. AI features ship inside the module they serve, on the AI foundation laid in Phase 0. Phase 1 is the first production-ready release. Requirement IDs from Section 5 map into phases as noted, giving direct traceability from plan to build to test."),

  ...phase(0, "Foundations + AI Core",
    "Stand up the skeleton everything else hangs on: project, database, identity, configuration, design system — and the AIService so later phases add AI features by writing prompts and schemas, not plumbing.",
    [
      "Initialise repository, Next.js + TypeScript project, Prisma + PostgreSQL, CI (lint, typecheck, tests), Docker Compose for local run.",
      "Authentication (credentials + verification + password recovery) and the role/permission model with server-side guard (XC-01, SYS-01, SYS-02).",
      "Institution configuration and white-label layer: name, logo, colours, templates (SYS-03); seed script producing a full demo university (UENR-like structure: 9 schools, departments, programmes).",
      "Design system: layout shells for the five portals, core components (forms, tables, wizards, dashboards), responsive and low-bandwidth defaults (NFR-14, NFR-21).",
      "Append-only audit writer and mutation helpers (XC-04); notification engine core with in-app centre and email adapter + mock (XC-02).",
      "AIService layer: Anthropic SDK integration, per-feature config (model, effort, budget), streaming chat endpoint + reusable chat UI component, structured-output helper (Zod), knowledge-base ingestion (chunking + full-text index) and retrieval, prompt-cache-aware prompt builder, AI audit logging, deterministic mock provider (Section 8).",
    ],
    "Running application with login, portals' empty shells, seeded demo data, working demo chatbot answering from two seeded documents, CI green.",
    "A demo user of each role can sign in and see their portal shell; the demo assistant answers a handbook question with a citation and refuses an out-of-scope one; all AI calls appear in the AI audit log; the whole stack runs offline on mocks."),

  ...phase(1, "Admissions Portal (MVP — first production release)",
    "Deliver the complete applicant journey and admissions back office — the system's public debut. Covers AP-01…AP-22, ADM-01…ADM-18, and the admissions rows of Sections 6–8.",
    [
      "Public programme catalogue and eligibility checker (AP-01, AP-02).",
      "Applicant accounts; application fee payment via Paystack sandbox + voucher redemption (AP-04, AP-05, ADM-03).",
      "Multi-step application wizard with autosave, document uploads, review-and-submit (AP-06, AP-07, AP-11).",
      "AI: applicant assistant grounded on admissions knowledge base (AP-03); document extraction auto-fill with applicant confirmation (AP-08, AP-09); pre-screen + summary + flags on submission (ADM-06); programme recommender (AP-10).",
      "Officer review queue, info-request loop, recommendations, approval step, bulk offer issuance with PDF letters + verification codes (ADM-05…ADM-10, AP-13, AP-14).",
      "Acceptance + acceptance-fee payment, public admission-list lookup, letter verification page, fraud warnings (AP-15, AP-20, AP-21).",
      "Cycle configuration, quotas, dashboards, exports; applicant messaging with AI-drafted replies (ADM-01, ADM-02, ADM-04, ADM-14, ADM-15).",
    ],
    "Production-ready admissions portal: an institution can run a real admission cycle end to end.",
    "A test applicant completes the entire journey — browse → pay → apply (with a scanned result slip auto-filled) → submit → receive offer → verify letter → accept — while an officer processes it with AI pre-screen assistance and every decision carries a human approval in the audit log."),

  ...phase(2, "SIS Core & Enrollment",
    "Convert admitted applicants into students and establish the master student record. Covers REG-01…REG-06, ST-02, ST-03.",
    [
      "Bulk enrollment from accepted offers; matriculation-number generation (REG-04, ST-02).",
      "Student 360° profile with timeline; identity-change request workflow (ST-03, REG-06).",
      "Academic structure management UI (REG-01) and academic calendar management (REG-02) — replacing seed-only setup.",
      "Student portal dashboard v1 (ST-01) and profile self-service.",
    ],
    "Every accepted applicant is a student with a record, number and working portal.",
    "An admitted test applicant appears as a student with a generated index number, correct programme and curriculum version, and can sign in to a populated dashboard — with zero manual re-entry."),

  ...phase(3, "Course Registration",
    "Semester registration with all rules enforced. Covers ST-04…ST-08, LEC-01, LEC-02, HOD-02, plus the AI academic advisor (ST-20).",
    [
      "Course offerings per semester with lecturer assignment (HOD-02).",
      "Registration wizard: curriculum-driven course lists, credit limits, prerequisites, fee-gate stub (full gate arrives with Phase 5), add/drop, proof of registration (ST-04…ST-08).",
      "Optional advisor approval flow (LEC-16); class lists live for lecturers (LEC-01, LEC-02).",
      "AI academic advisor v1: degree audit + elective guidance from curriculum and (once Phase 4 lands) results (ST-20).",
    ],
    "Students self-register within enforced rules; lecturers see real class lists.",
    "A test student cannot exceed credit limits, register an unmet-prerequisite course, or register outside the window; their advisor sees and approves the registration; the AI advisor correctly lists outstanding curriculum requirements."),

  ...phase(4, "Examinations & Results",
    "The academic heart: grading, approvals, computation, publication, transcripts. Covers LEC-05…LEC-11, HOD-04, DEA-02, EXO-01…EXO-14, REG-05, ST-09, ST-10.",
    [
      "Assessment structures and CA recording (LEC-08); grade sheets with CSV import and validation (LEC-09).",
      "Approval chain Lecturer → HoD → Dean → EXO → Registrar publish, with tracking and returns (LEC-10, LEC-11, HOD-04, DEA-02, EXO-04).",
      "Results engine: GPA and CWA regimes, standings, honours/referred lists, resit handling (REG-03 config, EXO-05, EXO-07).",
      "Publication with student views and notifications (ST-09); remark workflow (ST-10, EXO-09); amendment workflow (REG-11); transcripts with verification codes (EXO-10).",
      "Exam timetable with clash detection (EXO-01…EXO-03); malpractice register (EXO-08).",
      "AI: grading assistance for written answers (LEC-07), class insights (LEC-14), anomaly observations (EXO-14), early-warning flags to counsellors (CNS-04).",
    ],
    "Full results pipeline from lecturer's mark to student's screen to transcript.",
    "A complete semester's grades flow through every approval to publication; a student sees correct GPA/CWA per the configured regime; a transcript generates and verifies publicly; an AI-suggested essay score is visibly advisory until the lecturer accepts it."),

  ...phase(5, "Fees & Finance",
    "Billing, collection, reconciliation and the fee gates other modules rely on. Covers FIN-01…FIN-16, ST-11…ST-13, PAR-01…PAR-06.",
    [
      "Fee schedules and bulk billing (FIN-01, FIN-02); student statements and receipts (ST-11, FIN-15).",
      "Paystack integration live-pattern: webhook reconciliation, mobile-money flows, teller confirmation queue (ST-12, ST-13, FIN-03, FIN-04).",
      "Fee gates wired into registration/results per configuration (FIN-05); exceptions, sponsors, refunds, period close (FIN-06…FIN-08, FIN-11).",
      "Arrears dashboard and reminder campaigns (FIN-09, FIN-10); parent/sponsor read-only fee access and payment (PAR-01…PAR-06).",
      "AI: collection summaries and anomaly notes (FIN-14); fee questions answered by the student assistant from live balances (ST-19).",
    ],
    "Money in, reconciled, receipted — and enforcing the gates everywhere.",
    "A sandbox mobile-money payment updates a student's balance and unblocks registration within seconds; a teller submission requires finance confirmation; the audit trail explains every cedi on a statement; a linked sponsor pays a student's bill."),

  ...phase(6, "Accommodation",
    "The hostel hub, integrated with billing. Covers ACC-01…ACC-13, ST-14.",
    [
      "Inventory, pricing, booking windows and rules (ACC-01…ACC-03).",
      "Student booking flow with automatic billing and expiry of unpaid bookings (ST-14, ACC-08).",
      "Occupancy dashboards, manual allocations, check-in/out, maintenance tickets, resident exports (ACC-04…ACC-07, ACC-09).",
    ],
    "Students book and pay for beds online; managers see live occupancy.",
    "A test student books a bed, pays, and downloads an allocation slip; an unpaid booking expires back to the pool on schedule; occupancy numbers match bookings exactly."),

  ...phase(7, "E-Learning (LMS-lite)",
    "Course spaces synchronised with registration. Covers LEC-03…LEC-07, LEC-12, LEC-13, ST-15.",
    [
      "Auto-created course spaces with rosters from registration; materials by week/topic (LEC-03).",
      "Assignments with deadline rules and submissions; quizzes with auto-marking; scores feeding CA (LEC-04, LEC-05, LEC-08, ST-15).",
      "Attendance sessions (LEC-12); course announcements (LEC-13).",
      "AI: quiz/assignment generation from materials with lecturer approval (LEC-06); grading assistance embedded in marking view (LEC-07); content summarisation.",
    ],
    "Every registered course has a working online space.",
    "A lecturer publishes AI-drafted-then-edited quiz questions; students submit an assignment before deadline and are blocked after; quiz scores appear in the CA record automatically."),

  ...phase(8, "Communications & Document Services",
    "The messaging engine matured, plus paid document requests. Covers ST-17, ST-25, EXO-10, EXO-11, ALU-02, campaign requirements, SYS-12.",
    [
      "SMS adapter (Hubtel/mNotify) joins email; template manager; campaign builder with audience segments and statistics.",
      "Notification preference centre within statutory minimums (XC-02).",
      "Document request service: request → pay → fulfil → dispatch → verify, for transcripts, attestations, verifications (ST-17, EXO-10, EXO-11).",
      "AI: campaign/announcement drafting with approval flow.",
    ],
    "Targeted, measured communications and a self-service documents desk.",
    "A finance officer sends an arrears SMS campaign to a filtered segment and sees delivery stats; a student orders a transcript, pays, tracks it to dispatch, and an employer verifies it by code."),

  ...phase(9, "Library, HR & Timetabling",
    "Three self-contained operational modules. Covers LIB-01…LIB-12, HRO-01…HRO-12, timetabling requirements.",
    [
      "Library: catalogue, circulation, holds, fines (via finance), OPAC search, clearance wiring (LIB-01…LIB-12).",
      "HR: staff registry, appointments driving access, leave workflows, directory publishing, appraisal cycle (HRO-01…HRO-12).",
      "Timetabling: venue registry, teaching timetable builder with clash detection, personal views and change alerts (ST-16).",
    ],
    "Operational backbone modules live.",
    "A borrowed, unreturned book blocks a test student's clearance item; making a staff member HoD on an effective date grants HoD access that day; a venue double-booking is rejected at save."),

  ...phase(10, "Graduate Studies, Alumni & Analytics",
    "The research pipeline, the graduate relationship, and the intelligence layer. Covers GSO-01…GSO-13, ALU-01…ALU-10, MGT-01…MGT-10, QAO-01…QAO-10, CNS-01…CNS-10.",
    [
      "Graduate studies: candidatures, supervision, milestones, submissions, panels, examiner reports, thesis repository (GSO-*).",
      "Student affairs & QA: confidential case management, evaluations with AI theme summarisation, accreditation evidence library (CNS-*, QAO-*).",
      "Graduation & clearance end-to-end (ST-23, REG-09) with alumni conversion (ALU-01) and alumni services (ALU-02…ALU-10).",
      "Analytics: executive dashboards, report library, scheduled briefs; AI natural-language analytics assistant over safe query tools with permission scoping (MGT-01…MGT-03, MGT-09).",
    ],
    "Full lifecycle closed — applicant to alumnus — with management intelligence on top.",
    "A postgraduate milestone advances only on supervisor approval; a graduating student's clearance turns green from live module data and their account becomes an alumni account; management asks a plain-English question and gets a correct, permission-scoped chart with visible query logic."),

  ...phase(11, "Hardening & Launch",
    "Make it production-grade and hand it over.",
    [
      "Security pass: penetration-test checklist against NFR-01…NFR-08, dependency audit, secrets review.",
      "Performance: load tests for registration-day and results-day profiles (NFR-15); query and cache tuning.",
      "Operations: backup/restore drills (NFR-19), monitoring and alerting, runbooks, maintenance mode.",
      "AI governance review: budgets, prompts, logging, red-team of the assistants (prompt-injection resistance, data-scoping tests).",
      "Documentation and training: administrator guide, officer guides per module, student/applicant help centre content (also feeding the knowledge base).",
      "Production deployment (Docker on the chosen host), go-live checklist, hypercare period.",
    ],
    "A launched, documented, monitored production system.",
    "Restore drill succeeds within RTO; load test passes at target concurrency; AI red-team findings closed; go-live checklist signed off."),

  spacer(),
  h2("Sequencing at a Glance"),
  table(
    ["Phase", "Focus", "Depends on", "First usable by"],
    [
      ["0", "Foundations + AI core", "—", "Developers/demo"],
      ["1", "Admissions portal (MVP)", "0", "Applicants + admissions office"],
      ["2", "SIS core & enrollment", "1", "Registrar"],
      ["3", "Course registration", "2", "Students + lecturers"],
      ["4", "Examinations & results", "3", "Whole academic chain"],
      ["5", "Fees & finance", "2 (gates strengthen 3 & 4)", "Finance + students"],
      ["6", "Accommodation", "5", "Students + hostel office"],
      ["7", "E-learning", "3", "Lecturers + students"],
      ["8", "Communications & documents", "2 (richer after 4, 5)", "Everyone"],
      ["9", "Library, HR, timetabling", "2", "Operations"],
      ["10", "Grad studies, alumni, analytics", "4, 5", "Management + grad school"],
      ["11", "Hardening & launch", "all", "The institution"],
    ],
    { widths: [8, 34, 26, 32] }
  ),
  spacer(),
  callout("WORKING RHYTHM", "Each phase ends with a runnable demo against seeded data and a short acceptance walkthrough of the criteria above. Phases 5–9 have limited interdependence and can be re-ordered or parallelised if priorities shift after the MVP."),
];

export const risksAndClosing = () => [
  h1("13. Risks, Assumptions and Glossary"),

  h2("13.1 Risks and Mitigations"),
  table(
    ["Risk", "Impact", "Mitigation"],
    [
      ["Scope creep across 18 modules", "Delays; MVP never ships", "Phase gates with acceptance criteria; changes join a backlog for later phases, never mid-phase"],
      ["Payment gateway friction (sandbox access, settlement setup)", "Blocks fee flows", "Adapter + mock lets everything build and demo without the gateway; Paystack sandbox integrated early in Phase 1"],
      ["AI cost overrun", "Budget pressure", "Prompt caching, per-feature budgets with hard stops, usage dashboard from day one, model configurable per feature (Section 8.5)"],
      ["AI errors / hallucination", "Wrong guidance or unfair screening", "Human-in-the-loop on all decisions; grounded answers with citations; advisory labelling; extraction always user-confirmed; red-team in Phase 11 (Section 7.5)"],
      ["Data migration from legacy systems", "Dirty or duplicated records", "Not on the critical path — system runs green-field from an admission cycle; a separate migration workstream with cleansing tools if the institution wants history imported"],
      ["Adoption resistance from staff", "Parallel paper processes persist", "Phase-by-phase training, per-role guides, and officer time savings front-loaded (AI drafting, auto-reconciliation)"],
      ["Low-bandwidth realities", "Poor student experience on mobile", "Performance budget enforced from Phase 0 (NFR-14); server-rendered pages; testing on throttled connections"],
      ["Key-person dependency in operations", "Fragile administration", "Runbooks, documented configuration, exportable data (SYS-15), standard stack with wide talent availability"],
      ["Regulatory change (fees policy, GTEC requirements)", "Rework", "Rules are configuration, not code (grading regimes, gates, requirements), so policy changes are settings changes"],
    ],
    { widths: [26, 22, 52] }
  ),
  spacer(),

  h2("13.2 Assumptions"),
  bullet("Single institution per deployment in v1; multi-tenant hosting is out of scope."),
  bullet("English is the only interface language in v1 (strings externalised for later localisation)."),
  bullet("The operator provisions: a server (VPS or cloud), a domain with TLS, a Paystack account, an SMS provider account, an SMTP/email provider, and an Anthropic API key."),
  bullet("The institution supplies its real structure (schools, programmes, curricula, fee schedules) during configuration; the UENR-like seed is for demo purposes."),
  bullet("Statutory retention and policy specifics (e.g. exact grading regime) are confirmed with the institution during Phase 0 configuration."),
  bullet("This document governs scope; changes are agreed as amendments per phase, not absorbed silently."),

  h2("13.3 Glossary"),
  table(
    ["Term", "Meaning"],
    [
      ["WASSCE", "West African Senior School Certificate Examination — the main entry qualification for Ghanaian school leavers"],
      ["Aggregate / cut-off", "The combined best-six-subjects score used in admission decisions; lower is better"],
      ["GTEC", "Ghana Tertiary Education Commission — regulator to which universities report"],
      ["Matriculation / index number", "The unique student identifier issued at enrollment"],
      ["CWA", "Cumulative Weighted Average — a grading regime (score average weighted by credits) used by several Ghanaian universities"],
      ["GPA", "Grade Point Average — the alternative grading regime based on grade points"],
      ["CA", "Continuous Assessment — coursework marks combined with the final exam per a configured ratio"],
      ["Resit / referred", "Re-examination of a failed course, often with a capped grade"],
      ["Deferral", "Approved pause of a student's programme for a period"],
      ["Clearance", "Confirmation from each unit (library, hostel, finance, department) that a student owes nothing before graduation"],
      ["Mobile money (MoMo)", "Phone-number-based payment (MTN MoMo, Telecel Cash, AT Money) — the dominant consumer payment method in Ghana"],
      ["Voucher (application)", "A pre-paid serial + PIN sold via banks/agents that unlocks an application"],
      ["RBAC", "Role-Based Access Control — permissions derive from assigned roles"],
      ["RAG", "Retrieval-Augmented Generation — the AI answers from retrieved official documents rather than memory"],
      ["Structured outputs", "Constraining the AI to reply in an exact machine-checkable JSON shape"],
      ["Human-in-the-loop", "The design rule that a person approves every consequential AI suggestion before it takes effect"],
      ["Prompt caching", "Reusing the unchanged part of an AI prompt so repeat requests cost a fraction of the first"],
      ["Adapter / mock", "A swappable connector to an external service, with an offline stand-in for development and testing"],
    ],
    { widths: [22, 78] }
  ),
  spacer(),
  callout("NEXT STEP", "Upon approval of this document, implementation begins at Phase 0. The first review milestone is the Phase 0 acceptance walkthrough (running skeleton + working demo assistant), followed by Phase 1 — the production-ready admissions portal."),
];
