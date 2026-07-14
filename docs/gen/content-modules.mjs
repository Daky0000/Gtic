// Sections 6–8: Module Specifications, AI Core, AI Architecture.
import { h1, h2, h3, p, bullet, table, callout, spacer } from "./helpers.mjs";

// Compact module spec block.
const mod = (num, name, purpose, screens, workflows, rules, data) => [
  h2(`6.${num} ${name}`),
  p([{ t: "Purpose. ", b: true }, purpose]),
  p([{ t: "Key screens: ", b: true }, screens]),
  p([{ t: "Core workflows:", b: true }]),
  ...workflows.map((w) => bullet(w)),
  p([{ t: "Business rules (highlights):", b: true }]),
  ...rules.map((r) => bullet(r)),
  p([{ t: "Data owned: ", b: true }, data]),
];

export const moduleSpecs = () => [
  h1("6. Module Specifications"),
  p("Each module below states its purpose, main screens, core workflows, headline business rules and the data it owns. Detailed behaviour is defined by the actor requirements in Section 5; this section describes how those behaviours are organised into buildable modules."),

  ...mod(1, "Admissions",
    "Run complete admission cycles from application to enrollment handover, replacing the standalone admission portal.",
    "Public programme catalogue; eligibility checker; application wizard (multi-step); applicant dashboard; officer review queue; decision board; cycle configuration; voucher manager; admission-list publisher.",
    [
      "Application lifecycle: Draft → Submitted → Under Review → Info Requested → Recommended → Approved → Offer Issued → Accepted/Declined/Expired → Enrolled. Every transition notifies the applicant.",
      "Decision workflow: officer recommendation → approving authority sign-off → bulk offer generation (PDF letters with verification codes).",
      "Voucher lifecycle: generated → distributed → sold → redeemed, with batch reporting.",
    ],
    [
      "No offer may be issued without a recorded human approval (ADM-09).",
      "An application is immutable after submission except through officer-mediated, audit-logged corrections.",
      "Quota tracking per programme with waitlist auto-release.",
      "Admission letters must be verifiable publicly by code (anti-fraud, AP-21).",
    ],
    "Admission cycles, applications, applicant documents, decisions, offers, vouchers, applicant messages."),

  ...mod(2, "Student Information System (SIS)",
    "Hold the single authoritative student record from enrollment to graduation — the module every other module trusts.",
    "Student profile (360° view with tabs: bio, academic, financial summary, documents, timeline); enrollment processor; status-change workflows; graduation/clearance manager.",
    [
      "Enrollment: accepted applicant → student with generated matriculation number; zero re-entry of data.",
      "Status changes: active ↔ deferred, withdrawn, dismissed, graduated — each via approval workflow with effective dates.",
      "Graduation: eligibility check (curriculum complete, fees cleared, clearances green) → Registrar approval → conferral record → alumni conversion.",
    ],
    [
      "Identity fields change only via Registrar-approved requests with evidence (ST-03, REG-06).",
      "Matriculation number format is configurable and numbers are never reused.",
      "Every record change appears on the student's timeline with actor and reason.",
    ],
    "Student master records, statuses and status history, enrollment records, clearance records, graduation records."),

  ...mod(3, "Programmes & Curriculum",
    "Model the academic structure so that registration, grading and progression can be computed rather than manually policed.",
    "School/department tree; programme editor; curriculum builder (per entry-year version); course catalogue with prerequisites.",
    [
      "Curriculum versioning: each entry-year cohort is bound to its curriculum version for life; changes create new versions rather than editing history.",
      "Curriculum approval: HoD proposes → Dean endorses → Registrar/Academic Board approves → active.",
    ],
    [
      "A course may appear in many curricula with different semesters/status (core/elective).",
      "Prerequisite chains are validated to be acyclic.",
      "Credit values and level codes are locked once results exist against a course offering.",
    ],
    "Schools, departments, programmes, curricula and versions, courses, prerequisites."),

  ...mod(4, "Course Registration",
    "Let students self-register within rules the system enforces automatically each semester.",
    "Registration wizard; advisor approval queue (optional); registration reports; add/drop manager; proof-of-registration PDF.",
    [
      "Semester registration: window opens per calendar → student selects within credit limits → fee-gate check → (optional) advisor approval → registered.",
      "Add/drop within its window with the same validations.",
      "Late registration with configurable penalty fee and approval.",
    ],
    [
      "Credit min/max per level and semester enforced at save time (ST-04).",
      "Prerequisite enforcement with clear messaging (ST-05).",
      "Fee-gate percentage configurable by finance within management policy (ST-06, FIN-05).",
    ],
    "Course offerings (course × semester × lecturers), registrations, add/drop records, approvals."),

  ...mod(5, "Examinations & Results",
    "Capture assessment, run the approval chain, compute standing, and publish results students can trust.",
    "Grade sheets (CA + exam entry, CSV import); approval tracker; results processing console; publication control; transcript generator; remark case manager; malpractice register.",
    [
      "Grade lifecycle: Lecturer draft → submit → HoD approve → Dean approve → EXO validate/process → Registrar publish. Returns at any step go back with queries.",
      "Results processing: compute grade → grade point → semester GPA/CWA → cumulative → standing → honours/referred lists, per configured grading regime.",
      "Amendments post-publication only via dual-authorised amendment workflow (REG-11).",
    ],
    [
      "Both GPA and CWA regimes supported via configuration (REG-03); resit capping rules configurable (EXO-13).",
      "No self-approval anywhere in the chain (HOD-11).",
      "Result visibility can be gated on fee threshold if the institution enables it (FIN-05).",
    ],
    "Assessment structures, scores, grade sheets, approvals, computed results, standings, transcripts, remark and malpractice cases."),

  ...mod(6, "Fees & Finance",
    "Bill correctly, collect easily (especially by mobile money), reconcile automatically, and gate other modules on payment status.",
    "Fee schedule builder; bill generator; student statement; payment console (gateway + teller confirmations); exceptions manager; arrears dashboard; sponsor accounts.",
    [
      "Billing: schedule activation → bulk invoice generation → student notification.",
      "Payment: gateway webhook → auto-match to bill → receipt PDF → gates re-evaluated instantly. Teller path: student submits slip → finance confirms.",
      "Exceptions: payment plan/scholarship/waiver request → approval → gate adjustment, all logged.",
    ],
    [
      "Every payment produces an immutable receipt with verification code.",
      "Unmatched payments never disappear — they sit in a queue until matched or refunded.",
      "Period close locks transactions; corrections are new entries, not edits (FIN-11).",
    ],
    "Fee schedules and items, invoices, payments, receipts, exceptions, sponsors, reconciliation records."),

  ...mod(7, "Accommodation",
    "Digitise the hostel hub: transparent booking, automatic payment linkage, real occupancy data.",
    "Hostel/room inventory manager; booking window control; student booking flow; occupancy dashboard; check-in/out register; maintenance tickets.",
    [
      "Booking: window opens → student books bed → hostel bill raised automatically → payment confirms bed → allocation slip issued; unpaid bookings auto-expire back to pool (ACC-08).",
      "Residency: check-in with condition notes → in residence → check-out with clearance implications.",
    ],
    [
      "One active bed per student, gender rules enforced by room designation.",
      "Manual overrides allowed for welfare/medical grounds with reasons (ACC-05).",
    ],
    "Hostels, blocks, rooms, beds, bookings, allocations, residency records, maintenance tickets."),

  ...mod(8, "E-Learning (LMS-lite)",
    "Give every registered course an online space — materials, assignments, quizzes — synchronised automatically with registration.",
    "Course space (per offering); materials manager; assignment submission and marking views; quiz builder and player; gradebook feed to CA.",
    [
      "Course spaces auto-created from offerings; rosters auto-synced from registration (no separate enrollment).",
      "Assignment: publish → submissions (with deadline rules) → marking (with AI assistance, LEC-07) → scores flow into CA.",
      "Quiz: build (optionally AI-drafted, LEC-06) → schedule → auto-mark objectives → results to CA.",
    ],
    [
      "Only registered students see a course space; access ends per retention policy after the semester.",
      "AI-suggested marks never post to CA without lecturer confirmation.",
    ],
    "Course spaces, materials, assignments, submissions, quizzes, attempts, attendance records."),

  ...mod(9, "Library",
    "Run lending operations and connect library standing to clearance automatically.",
    "Catalogue manager; circulation desk (checkout/checkin); member view; holds queue; fines console; public catalogue search (OPAC).",
    [
      "Circulation: checkout with policy-derived due date → return / renew → overdue fines accrue → fine payment via finance module.",
      "Holds: reserve → notify on return → pickup window → release.",
    ],
    [
      "Membership derives from active student/staff status (LIB-06).",
      "Clearance item auto-computed: nothing out + nothing owed = cleared (LIB-07).",
    ],
    "Bibliographic records, copies, loans, holds, fines, e-resource links."),

  ...mod(10, "HR & Staff",
    "Maintain the staff establishment and drive access rights from appointments.",
    "Staff registry; appointment recorder; leave workbench; staff self-service; directory publisher; appraisal cycle screens.",
    [
      "Appointment changes with effective dates automatically grant/revoke portal roles (HRO-05).",
      "Leave: apply → supervisor approve → HR record → balance update.",
    ],
    [
      "Access suspension on exit/interdiction is immediate and audit-logged (HRO-10).",
      "Directory publishes only fields marked public (HRO-08).",
    ],
    "Staff records, appointments, leave types/applications/balances, appraisal records, directory entries."),

  ...mod(11, "Timetabling",
    "Publish clash-free teaching and examination timetables tied to real registration data.",
    "Timetable builder (teaching); exam timetable builder; room/venue registry; personal timetable views; change alerts.",
    [
      "Build: assign offering → slot/venue → clash detection (lecturer, venue, student-group) → publish → per-person filtered views.",
      "Exam scheduling validates against actual registrations so no student has two papers at once (EXO-01).",
    ],
    [
      "Venue capacity checked against expected class size.",
      "Any change after publication triggers targeted alerts to affected people (ST-16).",
    ],
    "Venues, time slots, teaching timetables, exam timetables, invigilation assignments."),

  ...mod(12, "Communications & Notifications",
    "One engine for every message the university sends: in-app, email, SMS — targeted, templated, measured.",
    "Announcement composer; audience builder (segments); template manager; campaign monitor; per-user notification centre and preferences.",
    [
      "Event notifications: system events (results published, payment received…) render templates and fan out per user preference.",
      "Campaigns: build audience → draft (AI-assisted) → approve → schedule → send → delivery/read statistics.",
    ],
    [
      "Statutory notices override user opt-outs; marketing respects them (ALU-04).",
      "SMS spend is budgeted and reported per campaign.",
    ],
    "Templates, announcements, campaigns, delivery logs, user notification preferences."),

  ...mod(13, "Academic Document Services",
    "Turn transcript and verification requests from a paper queue into a tracked, paid, fulfilled service.",
    "Request wizard (student/alumni); payment step; fulfilment queue (EXO/REG); dispatch recorder; public verification checker.",
    [
      "Request: choose document + delivery → pay → queue → generate/approve → dispatch → close, with status visible throughout (ST-17).",
      "Third-party verification: code entered on public site → verified facts displayed → check logged (EXO-11).",
    ],
    [
      "Documents generate from live records — no manual re-typing.",
      "Every issued document carries a verification code (XC-07).",
    ],
    "Document requests, payments linkage, issued-document registry, verification logs."),

  ...mod(14, "Graduate Studies",
    "Track research students through supervision and milestones to examination.",
    "Candidature dashboard; milestone tracker; submission/feedback space; panel & viva scheduler; examiner report vault; thesis metadata repository.",
    [
      "Milestones advance only on supervisor/officer approval (GSO-05).",
      "Examination: panel setup → viva → outcome → corrections → final submission → clearance (GSO-06, GSO-09).",
    ],
    [
      "Candidature clocks with extension workflow (GSO-07).",
      "Examiner reports restricted to authorised roles.",
    ],
    "Candidatures, supervision assignments, milestones, submissions, panels, examiner reports, thesis metadata."),

  ...mod(15, "Alumni",
    "Keep graduates connected and served after conferral.",
    "Alumni profile; document request reuse; segment manager; campaign screens; giving/donation recorder; event registration.",
    [
      "Graduation triggers automatic account conversion (ALU-01).",
      "Giving: campaign → pledge/payment → acknowledgement.",
    ],
    [
      "Alumni control their own privacy/visibility settings (ALU-03).",
    ],
    "Alumni profiles, segments, campaigns, donations, event registrations."),

  ...mod(16, "Reporting & Analytics",
    "Give every officer the numbers for their remit and management the whole picture, without data extraction gymnastics.",
    "Role-scoped dashboards; report library with parameters; export centre; AI analytics assistant (Section 7); scheduled report subscriptions.",
    [
      "Standard reports parameterised by year/semester/programme with CSV/PDF export.",
      "Natural-language analytics via safe query tools (MGT-02) with the computed query visible.",
    ],
    [
      "Every figure is permission-scoped: a user can never chart data they could not list.",
      "Reports carry an as-of timestamp and data lineage note.",
    ],
    "Report definitions, schedules, generated report archive."),

  ...mod(17, "System Administration",
    "Operate the platform: identity, configuration, integrations, audit and continuity.",
    "User & role manager; institution config (white-label); integration settings; audit log explorer; job monitor; backup console; knowledge-base manager.",
    [
      "Role lifecycle with effective dates; MFA enforcement for privileged roles (SYS-01/02).",
      "Year rollover cloning structures safely (SYS-13).",
    ],
    [
      "Secrets encrypted at rest, never sent to the browser (SYS-04).",
      "Audit log is append-only; impersonation is consent-gated and loudly flagged (SYS-06, SYS-11).",
    ],
    "Users, roles, permissions, institution configuration, integration settings, audit logs, job records, knowledge documents."),

  spacer(),
  callout("MODULE 18 — AI CORE", "The AI Core is specified in its own right in Sections 7 and 8 because it cuts across every module above rather than standing beside them."),
];

export const aiCore = () => [
  h1("7. AI Core — Claude-Powered Capabilities"),
  p([
    "CampusCore is AI-cored: intelligence is a design principle of every module, implemented on ",
    { t: "Anthropic's Claude", b: true },
    ". The governing rule everywhere is ",
    { t: "human-in-the-loop", b: true },
    ": the AI answers, reads, drafts, screens and flags; a named human approves anything consequential. AI output is always labelled as such until approved (XC-06), and every AI interaction is audit-logged.",
  ]),

  h2("7.1 Admissions AI"),
  bullet([{ t: "Applicant assistant (24/7 chatbot). ", b: true }, "Answers questions about programmes, requirements, deadlines, fees and process — grounded exclusively in the university's published documents via the knowledge base, with citations to the source document and a human-contact handoff when unsure. (AP-03)"]),
  bullet([{ t: "Document intelligence. ", b: true }, "Reads uploaded WASSCE result slips, certificates and transcripts (image or PDF) with Claude's vision capability, extracts structured data (subjects, grades, index numbers, dates) into the application form for the applicant to confirm, and flags mismatches between typed entries and documents. (AP-08, AP-09)"]),
  bullet([{ t: "Eligibility pre-screen & summaries. ", b: true }, "For each submitted application, produces a structured advisory: requirements met/not met against the programme's configured rules, a one-paragraph applicant summary, and flags (duplicates, inconsistencies, missing items) — shown to the officer beside the raw data, never replacing it. (ADM-06)"]),
  bullet([{ t: "Programme recommender. ", b: true }, "Suggests best-fit programmes from an applicant's grades and stated interests, with reasons. (AP-10)"]),
  bullet([{ t: "Reply drafting. ", b: true }, "Drafts responses to applicant tickets grounded in policy, for the officer to edit and send. (ADM-14)"]),

  h2("7.2 Student AI"),
  bullet([{ t: "Student assistant (24/7 chatbot). ", b: true }, "Answers policy questions from official documents and personal questions (balance, registration, deadlines) from the student's own records only — strict per-user data scoping. (ST-19)"]),
  bullet([{ t: "AI academic advisor. ", b: true }, "Degree audit (what remains to graduate), elective guidance, GPA what-if scenarios, study planning — grounded in the student's curriculum version and actual results. (ST-20)"]),
  bullet([{ t: "Early-warning signals. ", b: true }, "Watches for risk patterns (sharp GPA decline, repeated failure, attendance collapse) and raises neutral, data-backed flags to counsellors — never to the student directly, and never as a judgment. (CNS-04)"]),

  h2("7.3 Lecturer AI"),
  bullet([{ t: "Assessment generation. ", b: true }, "Drafts quizzes and assignments from the lecturer's own uploaded materials; the lecturer edits and approves every item. (LEC-06)"]),
  bullet([{ t: "Grading assistance. ", b: true }, "Suggests scores with rationale for written answers against the lecturer's marking scheme; lecturer accepts/adjusts each one. (LEC-07)"]),
  bullet([{ t: "Class insights. ", b: true }, "Post-grading analysis: distributions, commonly missed questions, notable individual changes. (LEC-14)"]),
  bullet([{ t: "Content summarisation. ", b: true }, "Summarises long materials into study outlines the lecturer can publish."]),

  h2("7.4 Officer & Management AI"),
  bullet([{ t: "Natural-language analytics. ", b: true }, "“How many applicants chose Engineering this cycle vs last?” — Claude calls safe, read-only, parameterised query tools (never raw SQL), scoped to the asker's permissions, and presents figures/charts with the query logic visible. (MGT-02)"]),
  bullet([{ t: "Drafted reports & briefs. ", b: true }, "First drafts of departmental, school, QA, finance and admissions reports/briefs from live data; officers edit and approve. (HOD-09, DEA-07, QAO-09, FIN-14, MGT-03)"]),
  bullet([{ t: "Communication drafting. ", b: true }, "Announcement/email/SMS campaign drafts in the institution's tone, always approved before sending."]),
  bullet([{ t: "Anomaly observations. ", b: true }, "Advisory flags in exams (odd grade distributions) and finance (duplicate receipts, unusual reversals) for human investigation. (EXO-14, FIN-14)"]),

  h2("7.5 Rules That Bind Every AI Feature"),
  bullet("Human decision rule: no admission decision, grade, payment action or record change is ever executed by AI alone."),
  bullet("Grounding rule: assistants answer only from the published knowledge base and the requesting user's own permitted records; when the ground truth is absent, the assistant says so and offers the human channel."),
  bullet("Scoping rule: AI tools run under the identity and permissions of the requesting user — the model can never retrieve data the user could not open themselves."),
  bullet("Labelling rule: AI-suggested content is visually marked until a human approves it; the approval is recorded (XC-06)."),
  bullet("Privacy rule: prompts are PII-minimised (identifiers pseudonymised where the task allows); counselling records are wholly excluded from AI processing (CNS-03)."),
  bullet("Logging rule: every AI call (feature, user, tokens, outcome) is logged for audit and cost governance."),
  bullet("Availability rule: if the AI service is down or the budget is exhausted, every underlying function still works manually — AI degrades gracefully, it is an accelerant, not a dependency."),
  bullet("Control rule: each feature can be enabled/disabled independently and given its own model and monthly token budget by the administrator (SYS-05)."),
];

export const aiArchitecture = () => [
  h1("8. AI Architecture (Claude API)"),

  h2("8.1 Placement in the System"),
  p([
    "All AI functionality flows through a single server-side ",
    { t: "AIService", b: true },
    " layer wrapping the official Anthropic TypeScript SDK (",
    { t: "@anthropic-ai/sdk", i: true },
    "). The Anthropic API key lives only on the server (encrypted configuration); the browser talks to our own endpoints, never to Anthropic. The AIService exposes typed functions per feature (e.g. answerApplicantQuestion, extractDocumentData, prescreenApplication, draftReport) so the rest of the codebase never handles prompts directly.",
  ]),

  h2("8.2 Models"),
  p([
    "Default model for all features: ",
    { t: "claude-opus-4-8", b: true },
    " — Anthropic's most capable generally-priced tier, appropriate for document extraction accuracy, grounded answers and analysis. Each feature's model is configurable, so high-volume conversational routes can later be tuned to a faster/cheaper model if the institution chooses. Current reference pricing:",
  ]),
  table(
    ["Model", "ID", "Context", "Input /1M tok", "Output /1M tok", "Suggested use"],
    [
      ["Claude Opus 4.8", "claude-opus-4-8", "1M", "$5.00", "$25.00", "Default for all features"],
      ["Claude Sonnet 5", "claude-sonnet-5", "1M", "$3.00", "$15.00", "Optional: high-volume drafting"],
      ["Claude Haiku 4.5", "claude-haiku-4-5", "200K", "$1.00", "$5.00", "Optional: simple/burst chatbot traffic"],
    ],
    { widths: [17, 18, 9, 14, 14, 28] }
  ),
  spacer(),
  p([
    "Requests use adaptive thinking (",
    { t: "thinking: { type: \"adaptive\" }", i: true },
    ") with per-feature effort settings (",
    { t: "output_config.effort", i: true },
    "): higher effort for extraction and pre-screening where correctness matters, lower for conversational speed."
  ]),

  h2("8.3 Capability Mapping"),
  table(
    ["System feature", "Claude API capability", "How"],
    [
      ["Chat assistants (applicant, student)", "Streaming Messages API", "client.messages.stream(...) for token-by-token responses in the chat UI; conversation history persisted per user"],
      ["Document extraction (result slips, certificates)", "Vision / PDF input + structured outputs", "Uploaded image/PDF sent as a base64 content block; response constrained to a Zod-validated schema via client.messages.parse + zodOutputFormat — extraction is machine-checkable, never free text"],
      ["Eligibility pre-screen & scoring", "Structured outputs", "Programme rules + application data in, fixed JSON verdict schema out (requirementsMet, flags[], summary)"],
      ["Analytics assistant", "Tool use (tool runner)", "client.beta.messages.toolRunner with betaZodTool-defined, read-only, parameterised query tools (e.g. countApplications({programme, cycle})); the model composes tools, our code executes them under the user's permissions"],
      ["Knowledge-grounded answers (RAG)", "Retrieval + prompt caching", "Relevant document chunks retrieved (PostgreSQL full-text search in v1; pgvector upgrade path) and injected into a stable, cached system prefix (cache_control: ephemeral) so repeat traffic reads the cache at ~10% input cost"],
      ["Report/communication drafting", "Messages API", "Live data serialised into the prompt; drafts returned for human editing"],
      ["Grading assistance", "Structured outputs", "Marking scheme + student answer in; {suggestedScore, rationale} out for lecturer review"],
    ],
    { widths: [26, 22, 52] }
  ),
  spacer(),

  h2("8.4 Knowledge Base (RAG) Design"),
  bullet("Sources: student handbook, examination regulations, fee schedules, admission requirements, hostel rules, FAQs — uploaded and versioned by the Registrar/administrator (REG-12, SYS-09)."),
  bullet("Ingestion: documents are split into semantically coherent chunks with titles and effective dates, stored in PostgreSQL with full-text indexes (v1). An upgrade path to pgvector + an embeddings provider is designed in but not required for launch."),
  bullet("Answering: retrieve top chunks for the question → compose into the (cached) system context → Claude answers with citation markers pointing at source documents → UI renders the citations."),
  bullet("Freshness: publishing a new document version re-indexes automatically; assistants always answer from the currently published set."),

  h2("8.5 Cost, Safety and Reliability Controls"),
  bullet([{ t: "Prompt caching: ", b: true }, "stable system prompts and knowledge prefixes carry cache_control breakpoints; volatile content (the user's question) comes last — the difference is roughly a 90% input-cost reduction on repeat chatbot traffic."]),
  bullet([{ t: "Budgets: ", b: true }, "per-feature monthly token budgets with soft-warning and hard-stop thresholds; an AI usage dashboard (tokens, cost, per feature/day) for administrators and management (MGT-09)."]),
  bullet([{ t: "Rate limiting: ", b: true }, "per-user request limits on AI endpoints to prevent abuse of the chatbots."]),
  bullet([{ t: "Error handling: ", b: true }, "typed SDK exceptions with exponential-backoff retry for transient failures (429/5xx); refusal and max-token stop reasons handled explicitly; on any AI failure the UI falls back to the manual path with a clear message."]),
  bullet([{ t: "Mock provider: ", b: true }, "development and automated tests run against a deterministic mock AI provider behind the same AIService interface — no API spend, no network dependency in CI."]),
  bullet([{ t: "Audit: ", b: true }, "every call logged (feature, user, model, token counts, latency, outcome) into AIAuditLog; prompts stored with PII minimisation applied."]),
  callout("COST EXPECTATION", "With caching and per-feature budgets, a mid-size deployment's AI spend is dominated by chatbot traffic and admissions-season document extraction. The usage dashboard makes the spend visible from day one, and every feature can be individually throttled or disabled — the institution is always in control of the bill."),
];
