// Sections 1–3: Executive Summary, UENR Case Study, Vision Goals & Scope.
import { h1, h2, p, bullet, table, callout, spacer } from "./helpers.mjs";

export const executiveSummary = () => [
  h1("1. Executive Summary"),
  p([
    { t: "CampusCore", b: true },
    " (working title, fully rebrandable) is an ",
    { t: "AI-cored, integrated University Management System", b: true },
    " designed to run the complete digital life of a modern university — from the moment a prospective applicant first visits the website, through admission, enrollment, course registration, teaching and learning, examinations and results, fees, accommodation and graduation, all the way to alumni engagement.",
  ]),
  p([
    "The system is modeled on the real-world structure and needs of the ",
    { t: "University of Energy and Natural Resources (UENR)", b: true },
    ", Sunyani, Ghana, which today operates a collection of separate, disconnected portals (admissions, student records, e-learning, accommodation, library). CampusCore replaces that fragmentation with one platform offering five role-based experiences: a public website, an applicant portal, a student portal, a staff/faculty portal, and an administrative back office.",
  ]),
  p([
    "What makes this system different is that artificial intelligence is not an add-on — it is the core. Powered by ",
    { t: "Anthropic's Claude API", b: true },
    ", every module ships with built-in intelligence: a 24/7 assistant that answers applicant and student questions from official university documents; document intelligence that reads uploaded results slips and certificates and fills in application forms automatically; decision support that pre-screens applications against programme requirements; an AI academic advisor for students; grading and content assistance for lecturers; and natural-language analytics for management. In every case, ",
    { t: "humans make the final decision", b: true },
    " — the AI drafts, recommends, and flags; officers approve.",
  ]),
  p([
    "Delivery is phased. ",
    { t: "Phase 1 delivers a production-ready Admissions Portal", b: true },
    " — the highest-visibility, highest-volume part of any university's digital presence — and each following phase adds a module of the student lifecycle until the full system is live. Every phase in this document is specified with objectives, task lists, deliverables and acceptance criteria so that implementation can begin immediately upon approval.",
  ]),
  callout("KEY FACTS", "Stack: Next.js + TypeScript + PostgreSQL (Prisma). AI: Anthropic Claude API. Payments: Paystack (cards + MTN/Vodafone/AirtelTigo mobile money). 5 portals, 18 modules, ~19 actor roles, 12 delivery phases. Branding, school structure, grading rules (GPA/CWA) and fee rules are all configurable — the product is inspired by UENR but deployable for any institution."),
];

export const uenrCaseStudy = () => [
  h1("2. Institutional Case Study — UENR"),
  h2("2.1 Who UENR Is"),
  p([
    "The University of Energy and Natural Resources is a public university established by an Act of the Parliament of Ghana (Act 830) on 31 December 2011, with its main campus in Sunyani in the Bono Region. Its mandate is to be a centre of excellence in energy and natural resources, approaching those fields through science, engineering, economics, law, policy and management. Its vision is to become a world-class institution for generating, advancing and applying knowledge in energy and natural resource sciences, and its stated core values are summarised as ",
    { t: "RISE", b: true },
    ": Responsibility, Innovation, Sustainability, Excellence and Engagement.",
  ]),
  h2("2.2 Scale and Structure"),
  bullet([{ t: "Nine schools: ", b: true }, "Natural Resources; Energy; Engineering; Sciences; Agriculture and Technology; Geosciences; Arts and Social Sciences; Graduate Studies; Mines and Built Environment."]),
  bullet([{ t: "Multi-campus: ", b: true }, "Sunyani (main), Nsoatre and Dormaa Ahenkro campuses (~4,085 acres combined) plus four field training stations (Mim, Bronsankoro, Kyeraa, Bui)."]),
  bullet([{ t: "People: ", b: true }, "roughly 520 staff and a student population in the thousands, spanning undergraduate, postgraduate and distance programmes."]),
  bullet([{ t: "Research: ", b: true }, "multiple research centres and institutes (e.g. RCEES, EORIC, RELAB, CeRAB) focused on environment and energy."]),
  h2("2.3 The Problem: Fragmented Digital Systems"),
  p("Like many universities in the region, UENR's digital services grew organically and now live on separate systems that do not share data:"),
  table(
    ["Current system", "What it does", "Pain point"],
    [
      ["Admission Portal (admissions.uenr.edu.gh)", "Online application submission", "Separate accounts; manual re-entry of admitted students into records"],
      ["“Academic Tracker” SIS (sis.uenr.edu.gh)", "Student records and academic progress", "Not connected to admissions, fees or e-learning"],
      ["e-Learning platform", "Course content and online learning", "Separate login; enrollment not synced with registration"],
      ["Accommodation Hub (accommodationhub.uenr.edu.gh)", "Hostel booking", "No visibility of fee status; standalone payments"],
      ["Library system", "Catalogue and borrowing", "Isolated user database"],
      ["Fee schedules / payments", "Published as documents; bank/manual payment", "Reconciliation is manual; students queue for confirmation"],
      ["Academic service requests", "Transcripts, verification letters", "Email/paper based, slow turnaround"],
    ],
    { widths: [28, 34, 38] }
  ),
  spacer(),
  p("Each fragment means duplicated student identities, manual data re-entry, reconciliation errors, and staff time spent answering the same routine questions. Students experience it as multiple logins, queues, and uncertainty about application status, results and fees."),
  h2("2.4 What This Plan Proposes"),
  p("One integrated platform with a single identity per person, a single source of truth for academic and financial records, and an AI layer that automates the routine work (answering questions, reading documents, drafting reports) so staff can focus on judgment and students get instant service."),
  callout("IMPORTANT", "CampusCore is inspired by UENR's structure and uses it as the reference case study throughout this document. It is a generic product: institution name, logo, colours, school/department structure, grading system, fee items and letter templates are all configuration, not code. Nothing in the delivered system will impersonate or claim affiliation with UENR unless a licence/engagement with the university itself is in place."),
];

export const visionScope = () => [
  h1("3. System Vision, Goals and Scope"),
  h2("3.1 Vision"),
  p("A single, AI-native platform through which every actor in the university — applicant, student, lecturer, officer, manager — does their work, with instant answers, automated paperwork, and trustworthy records."),
  h2("3.2 Goals"),
  bullet("One account, one identity: a person is created once (as an applicant) and carries the same identity through student life to alumni status."),
  bullet("Zero re-entry: data captured at any step (e.g. an application form) flows automatically to the next (enrollment, registration, fees) without manual copying."),
  bullet("Self-service first: any question or request that does not need human judgment is resolved instantly by the platform or its AI assistant, 24/7."),
  bullet("Decisions stay human: AI pre-screens, summarises, drafts and flags — admission decisions, grades and financial approvals are always made by an authorised person."),
  bullet("Auditability: every consequential action (grade change, admission decision, payment, AI recommendation) leaves a tamper-evident audit trail."),
  bullet("Works on Ghanaian infrastructure: fast on low-bandwidth mobile connections, integrates mobile money, deployable on a local VPS or cloud."),
  h2("3.3 The Five Portals"),
  table(
    ["Portal", "Audience", "Purpose"],
    [
      ["Public website", "Everyone", "Programmes catalogue, news, admissions information, contact — the university's public face"],
      ["Applicant portal", "Prospective students", "Apply, pay, upload documents, track status, accept offers"],
      ["Student portal", "Enrolled students", "Registration, results, fees, hostel, e-learning, requests, AI advisor"],
      ["Staff portal", "Lecturers & academic officers", "Class lists, grading, approvals, advising, departmental administration"],
      ["Admin back office", "Administrators & management", "Configuration, admissions management, finance, reporting, analytics, system administration"],
    ],
    { widths: [18, 24, 58] }
  ),
  spacer(),
  h2("3.4 Modules In Scope (all phased)"),
  table(
    ["#", "Module", "One-line description"],
    [
      ["1", "Admissions", "Application cycles, online applications, review workflow, offers and acceptance"],
      ["2", "Student Information System (SIS)", "The master student record: bio-data, programme, status, progression"],
      ["3", "Programmes & Curriculum", "Schools, departments, programmes, curricula, courses and prerequisites"],
      ["4", "Course Registration", "Semester registration with credit limits, prerequisites and approvals"],
      ["5", "Examinations & Results", "Grade capture, approval chain, GPA/CWA computation, publication, transcripts"],
      ["6", "Fees & Finance", "Fee schedules, billing, online payments (Paystack/mobile money), receipts, arrears"],
      ["7", "Accommodation", "Hostels, rooms, booking windows, allocation and hostel payments"],
      ["8", "E-Learning (LMS-lite)", "Course materials, assignments, quizzes, announcements per course"],
      ["9", "Library", "Catalogue, memberships, borrowing, returns and fines"],
      ["10", "HR & Staff", "Staff records, appointments, leave requests and approvals"],
      ["11", "Timetabling", "Teaching and examination timetables, rooms and clash detection"],
      ["12", "Communications", "Announcements, targeted email/SMS campaigns, in-app notifications"],
      ["13", "Academic Document Services", "Transcript, attestation and verification requests with payment and fulfilment"],
      ["14", "Graduate Studies", "Postgraduate admissions specifics, supervision and thesis milestone tracking"],
      ["15", "Alumni", "Alumni directory, verification and engagement"],
      ["16", "Reporting & Analytics", "Dashboards and exports for officers and management"],
      ["17", "System Administration", "Users, roles, permissions, institution configuration, audit logs, backups"],
      ["18", "AI Core", "Claude-powered assistants, document intelligence and decision support woven through modules 1–17 (Sections 7–8)"],
    ],
    { widths: [6, 30, 64] }
  ),
  spacer(),
  h2("3.5 Out of Scope (Version 1)"),
  bullet("Payroll and full financial accounting (general ledger) — the finance module covers student fees only; export hooks to accounting systems are provided."),
  bullet("Procurement / stores / asset management ERP functions."),
  bullet("Biometric hardware integration (fingerprint/ID-card readers) — data model leaves hooks for later integration."),
  bullet("Native mobile apps — the web app is fully responsive; native apps are a possible later phase."),
  bullet("Multi-institution (tenant) hosting — v1 serves a single institution per deployment; the configuration-first design keeps the door open."),
];
