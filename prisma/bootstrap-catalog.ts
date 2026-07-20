// SYDA-GTIC institutional catalog — the Center's REAL structure from the
// official website content strategy (2026): identity, School of Renewable
// Energy, departments, the five flagship programmes with their published
// intake windows, the module curriculum for each, and the public knowledge
// base for the AI assistant.
//
// Runs at every app boot via src/instrumentation.ts (and manually via
// create-demo-users.ts), so a FRESH production database becomes a usable
// portal without ever running the demo seed. Everything is create-if-missing
// or code-keyed upsert: admin edits made in-app are never overwritten, and
// records created here are never duplicated. The demo seed (seed.ts) remains
// the richer dev-only dataset; where the two overlap they share codes, so
// they converge instead of colliding.
import type { PrismaClient } from "@prisma/client";
import { chunkDocument } from "../src/lib/ai/chunker";

const INSTITUTION = {
  name: "SYDA — Green Energy & Innovation Center",
  shortName: "SYDA-GTIC",
  motto: "Training the engineers who power Africa's renewable future",
  address: "Sunyani Youth Development Association (SYDA) Centre, Sunyani, Bono Region, Ghana",
  website: "https://portal.gticglobal.com",
  // Phone/email intentionally unset — the Center will provide them; the
  // admin can fill both in from /admin/settings.
};

// Common eligibility line from the published admissions requirements.
const ELIGIBILITY =
  "Open to anyone aged 16–50 who can read and write — JHS, SHS, degree and postgraduate holders are all welcome.";

type ProgDef = {
  code: string;
  name: string;
  deptCode: string;
  entryRequirements: string;
  /** [closesMonth, closesDay, startsMonth, startsDay] from the published calendar. */
  intake: [number, number, number, number];
  modules: { code: string; title: string; description: string }[];
  provisional?: boolean;
};

const STRUCTURE = {
  school: { code: "SORE", name: "School of Renewable Energy" },
  departments: [
    { code: "DSE", name: "Department of Solar Energy" },
    { code: "DBE", name: "Department of Biogas & Biomass Engineering" },
    { code: "DWE", name: "Department of Wind Energy" },
    { code: "DEV", name: "Department of Electric Vehicles" },
    { code: "DESS", name: "Department of Energy Storage Systems" },
  ],
};

const PROGRAMMES: ProgDef[] = [
  {
    code: "SENG",
    name: "Solar Energy Engineering",
    deptCode: "DSE",
    intake: [12, 1, 1, 3],
    entryRequirements: `${ELIGIBILITY} Cohort runs 3 January – 31 March; admission closes 1 December.`,
    modules: [
      { code: "SENG 101", title: "Electrical Fundamentals I", description: "Basic principles of electricity, circuits and symbols, voltage, current, resistance and power." },
      { code: "SENG 102", title: "Electrical Fundamentals II", description: "Electrical safety rules and precautions; interpreting simple electrical circuits." },
      { code: "SENG 201", title: "Electrical Wiring I", description: "Wiring systems, electrical cables and conductors, wiring techniques and terminations." },
      { code: "SENG 202", title: "Electrical Wiring II", description: "Circuit breakers, fuses and protection devices; electrical installation and routine maintenance." },
      { code: "SENG 301", title: "Solar Energy & Systems I", description: "Solar energy overview, PV system components, panel types and configurations." },
      { code: "SENG 302", title: "Solar Energy & Systems II", description: "Charge controllers and battery systems; inverters and grid-connection fundamentals." },
      { code: "SENG 401", title: "Solar Installation, Repair & Integration I", description: "Panel mounting, system wiring and commissioning, fault diagnosis, repair and preventive maintenance." },
      { code: "SENG 402", title: "Solar Installation, Repair & Integration II", description: "Integration with building wiring; grid-tied, off-grid and hybrid systems; energy storage and backup power." },
    ],
  },
  {
    code: "BENG",
    name: "Biogas & Biomass Engineering",
    deptCode: "DBE",
    intake: [4, 1, 5, 1],
    entryRequirements: `${ELIGIBILITY} Cohort runs 1 May – 31 July; admission closes 1 April.`,
    modules: [
      { code: "BENG 101", title: "Introduction to Biogas & Organic Waste Management I", description: "Principles of biogas, sources of organic waste, the anaerobic digestion process." },
      { code: "BENG 102", title: "Introduction to Biogas & Organic Waste Management II", description: "Benefits of biogas systems; environmental and health impacts." },
      { code: "BENG 201", title: "Biogas Plant Design & Sizing I", description: "Digester types; household and farm-scale systems." },
      { code: "BENG 202", title: "Biogas Plant Design & Sizing II", description: "Gas demand estimation, digester volume calculation, retention time." },
      { code: "BENG 301", title: "Biogas System Components & Installation I", description: "Inlet/outlet chambers, gas storage systems, piping and valves." },
      { code: "BENG 302", title: "Biogas System Components & Installation II", description: "Gas purification (H2S removal), safety devices, leak detection and commissioning." },
      { code: "BENG 401", title: "Operation, Maintenance & Energy Integration I", description: "Feeding procedures, slurry management, pH/temperature monitoring, troubleshooting low gas production." },
      { code: "BENG 402", title: "Operation, Maintenance & Energy Integration II", description: "Cooking applications, biogas generators, CHP, integration with solar PV, economic analysis." },
    ],
  },
  {
    code: "WENG",
    name: "Wind Energy Engineering",
    deptCode: "DWE",
    intake: [8, 1, 9, 1],
    entryRequirements: `${ELIGIBILITY} Cohort runs 1 September – 30 November; admission closes 1 August.`,
    modules: [
      { code: "WENG 101", title: "Wind Energy Fundamentals I", description: "Introduction to wind power, history and development, principles of wind energy conversion." },
      { code: "WENG 102", title: "Wind Energy Fundamentals II", description: "Wind characteristics and speed measurement; environmental and safety considerations." },
      { code: "WENG 201", title: "Wind Turbine Components & Design I", description: "Turbine types (horizontal/vertical axis), rotor blades and aerodynamics." },
      { code: "WENG 202", title: "Wind Turbine Components & Design II", description: "Nacelle components — gearbox, generator, brakes; tower design; yaw and pitch control." },
      { code: "WENG 301", title: "Wind Resource Assessment & Site Analysis I", description: "Wind rose diagrams, Weibull distribution analysis, site selection criteria." },
      { code: "WENG 302", title: "Wind Resource Assessment & Site Analysis II", description: "Wind data collection methods; anemometers and wind vanes; environmental impact." },
      { code: "WENG 401", title: "Installation, Maintenance & Integration I", description: "Foundation design, tower erection, electrical wiring and grid connection, routine inspection." },
      { code: "WENG 402", title: "Installation, Maintenance & Integration II", description: "Fault diagnosis, grid integration, hybrid wind–solar systems, storage, power quality, project economics." },
    ],
  },
  {
    code: "ESS",
    name: "Energy Storage Systems",
    deptCode: "DESS",
    intake: [12, 1, 1, 3],
    entryRequirements: `${ELIGIBILITY} Cohort runs 3 January – 31 March; admission closes 1 December.`,
    provisional: true,
    modules: [
      { code: "ESS 101", title: "Fundamentals of Energy Storage", description: "Provisional module — full breakdown pending publication by the Center." },
      { code: "ESS 201", title: "Battery Technologies & Chemistries", description: "Provisional module — full breakdown pending publication by the Center." },
      { code: "ESS 301", title: "ESS Design, Sizing & Installation", description: "Provisional module — full breakdown pending publication by the Center." },
      { code: "ESS 401", title: "Operation, Maintenance & Integration", description: "Provisional module — full breakdown pending publication by the Center." },
    ],
  },
  {
    code: "EV",
    name: "Electric Vehicles",
    deptCode: "DEV",
    intake: [8, 1, 9, 1],
    entryRequirements: `${ELIGIBILITY} Cohort runs 1 September – 30 November; admission closes 1 August.`,
    provisional: true,
    modules: [
      { code: "EV 101", title: "Introduction to EV Technology", description: "Provisional module — full breakdown pending publication by the Center." },
      { code: "EV 201", title: "EV Battery Systems & Charging Infrastructure", description: "Provisional module — full breakdown pending publication by the Center." },
      { code: "EV 301", title: "Drivetrains, Motors & Power Electronics", description: "Provisional module — full breakdown pending publication by the Center." },
      { code: "EV 401", title: "EV Diagnostics, Maintenance & Repair", description: "Provisional module — full breakdown pending publication by the Center." },
    ],
  },
];

// The Center's four published 2-week intensives. Fees are 0 ("to be
// announced") until the developer prices them on the fees console —
// registration stays closed until then.
// The Center's real published training sessions (from the official
// Renewable Energy Training Application Form 2026) — replaces an earlier,
// invented catalog. Each runs in the same three scheduled batches
// (BATCH_STARTS below); a batch's end date is its start plus the course's
// own durationWeeks, so a 2-week and an 8-week course can share one intake
// calendar.
const SHORT_COURSES = [
  {
    code: "SPVM",
    name: "Solar PV Installation & Maintenance",
    description: "Install and maintain complete solar photovoltaic systems — panel sizing, wiring, inverters and battery banks — for residential, commercial and off-grid use.",
    audience: "Aspiring solar technicians, electricians, entrepreneurs and anyone building a career in solar installation",
    durationWeeks: 4,
  },
  {
    code: "WES",
    name: "Wind Energy Systems",
    description: "Design, install and maintain small-scale wind energy systems, from turbine siting to grid and battery integration.",
    audience: "Technicians and engineers exploring wind power generation and small-scale turbine systems",
    durationWeeks: 2,
  },
  {
    code: "BGT",
    name: "Biogas Energy Technology",
    description: "Build and operate biogas digesters that convert organic waste into clean cooking and heating fuel — a practical, income-generating skill.",
    audience: "Farmers, rural development practitioners and entrepreneurs producing clean energy from organic waste",
    durationWeeks: 2,
  },
  {
    code: "CREC",
    name: "Complete Renewable Energy Course",
    description: "The full intensive spanning solar PV, wind and biogas systems — the fastest path to becoming a well-rounded renewable energy technician.",
    audience: "Career-changers and job seekers wanting full-spectrum, hands-on training across every technology",
    durationWeeks: 8,
  },
];

const BATCH_STARTS = [
  { label: "Batch A", startDate: "2026-11-03" },
  { label: "Batch B", startDate: "2026-12-01" },
  { label: "Batch C", startDate: "2027-01-05" },
];

// Public knowledge base for the AI assistant — admissions requirements,
// intake calendar, short courses, payment channels, governance — drawn from
// the published website content. Create-only: in-app edits survive.
const KNOWLEDGE_DOCS = [
  {
    slug: "intakes-and-short-courses",
    title: "Intake Calendar & Short Courses",
    category: "admissions",
    text: `
# Who Can Apply
Admission is open to anyone who can read and write, aged 16 to 50. JHS, SHS, first degree, second degree and PhD holders are all welcome — what matters most is commitment to the practical work. Trainees must be willing to wear the prescribed training attire.

# Programme Intakes and Deadlines
Solar Energy Engineering (SENG): trains 3 January – 31 March; admission closes 1 December each year.
Biogas & Biomass Engineering (BENG): trains 1 May – 31 July; admission closes 1 April each year.
Wind Energy Engineering (WENG): trains 1 September – 30 November; admission closes 1 August each year.
Energy Storage Systems (ESS): trains 3 January – 31 March; admission closes 1 December each year.
Electric Vehicles (EV): trains 1 September – 30 November; admission closes 1 August each year.
Apply at least one month before your preferred start date.

# Short Courses (vocational intensives)
Solar PV Installation & Maintenance — 4 weeks.
Wind Energy Systems — 2 weeks.
Biogas Energy Technology — 2 weeks.
Complete Renewable Energy Course — 8 weeks (the full syllabus across solar, wind and biogas).
Each course runs in scheduled batches: Batch A starts 3 November 2026, Batch B starts 1 December 2026, Batch C starts 5 January 2027 (a batch's end date follows the course's own duration). Short courses suit working professionals, farmers and entrepreneurs who want one focused, applicable skill — or the complete course for a full-spectrum foundation. Registration fees are published on the short courses page once set.

# Payment Channels
The application voucher fee is paid online by card or mobile money (Paystack). Training fees can also be paid at Ghana Commercial Bank (GCB), Sunyani Branch — quote your reference number and send the receipt to the admissions team to complete enrolment.
`,
  },
  {
    slug: "about-the-center",
    title: "About SYDA-GTIC",
    category: "handbook",
    text: `
# The Center
SYDA — Green Energy and Innovation Center (SYDA-GTIC) is a TVET/NVTI-accredited renewable energy training center operating from the Sunyani Youth Development Association (SYDA) Centre in Sunyani, Bono Region, Ghana. Established in 2023, it officially began operations in January 2026. It is partly a non-governmental organization. Mission: to train the African youth in practical renewable energy technologies — solar, wind, biogas, biomass, EVs and energy storage — for efficient deployment and utilization. Core values: Excellence, Transparency, Innovation, Integrity.

# Training Philosophy
Hands-on practicals, field trips, industrial visits, internships and industrial attachments are the backbone of every programme. Trainees install, configure and troubleshoot real systems.

# Governance and Leadership
The Board is chaired by Ing. Prof. Nana Sarfo Agyemany Derkyi. The Director of Training is Ing. Ferka-Ahenkorah Atta Senior — MSc Sustainable Energy Management and BSc Renewable Energy Engineering (UENR), currently pursuing a PhD, with industry experience across Ghana's Energy Commission, GRIDCo, NEDCo, Dream Renewables and BAK Energy. The Manager is Mr. Kofi Boamah Arhin; Mr. Elkana Atikle Yaovi is Field Expert; Mr. Raphael Sarpong is Coordinator & Consultant.

# Accreditation and Partners
Accredited by TVET (Technical and Vocational Education and Training) and NVTI (National Vocational Training Institute). Academic and industry partners include RCEES, UENR, Sunyani Technical University, University of Mines – Tarkwa, KNUST, GIZ, RES4Africa, Dream Renewables and Net-Tech Renewables. Graduates gain access to internships and industrial attachments through this network, and every certificate carries a verification code checkable on the public verification page.
`,
  },
];

export async function bootstrapInstitutionCatalog(
  db: PrismaClient,
  log: (msg: string) => void = console.log
) {
  // 1. Institution identity — create only; /admin/settings owns it afterwards.
  if (!(await db.institution.findFirst())) {
    await db.institution.create({ data: INSTITUTION });
    log("✓ institution identity created (SYDA-GTIC)");
  }

  // 2. School, departments, programmes (code-keyed upserts).
  const school = await db.school.upsert({
    where: { code: STRUCTURE.school.code },
    update: {},
    create: STRUCTURE.school,
  });
  const deptIds = new Map<string, string>();
  for (const d of STRUCTURE.departments) {
    const dept = await db.department.upsert({
      where: { code: d.code },
      update: {},
      create: { ...d, schoolId: school.id },
    });
    deptIds.set(d.code, dept.id);
  }

  let curriculaCreated = 0;
  for (const p of PROGRAMMES) {
    const [admissionClosesMonth, admissionClosesDay, cohortStartsMonth, cohortStartsDay] = p.intake;
    // The intake window IS the published calendar — kept in sync on every
    // boot (there is no in-app editor for it, so nothing can be clobbered).
    const intakeFields = { admissionClosesMonth, admissionClosesDay, cohortStartsMonth, cohortStartsDay };
    const programme = await db.programme.upsert({
      where: { code: p.code },
      update: intakeFields,
      create: {
        code: p.code,
        name: p.name,
        level: "DIPLOMA",
        durationSemesters: 1, // one 3-month cohort
        departmentId: deptIds.get(p.deptCode)!,
        entryRequirements: p.entryRequirements,
        ...intakeFields,
      },
    });

    // 3. Module curriculum — only when the programme has none yet, so both
    // the demo seed's richer local data and any in-app curriculum work are
    // left untouched.
    const hasCurriculum = await db.curriculumVersion.findFirst({
      where: { programmeId: programme.id },
    });
    if (hasCurriculum) continue;

    const courseIds: string[] = [];
    for (const m of p.modules) {
      const course = await db.course.upsert({
        where: { code: m.code },
        update: {},
        create: {
          code: m.code,
          title: m.title,
          credits: 3,
          departmentId: deptIds.get(p.deptCode)!,
          description: m.description,
        },
      });
      courseIds.push(course.id);
    }
    const curriculum = await db.curriculumVersion.create({
      data: {
        programmeId: programme.id,
        name: "2026 cohort",
        minCredits: 3,
        maxCredits: p.modules.length * 3,
      },
    });
    await db.curriculumCourse.createMany({
      data: courseIds.map((courseId) => ({
        curriculumId: curriculum.id,
        courseId,
        semesterNumber: 1,
        type: "CORE" as const,
      })),
    });
    curriculaCreated++;
  }
  log(
    `✓ academic catalog: ${STRUCTURE.departments.length} departments, ${PROGRAMMES.length} programmes` +
      (curriculaCreated ? `, ${curriculaCreated} curricula created` : "")
  );

  // 4. Short courses + their batches — create-only; fees, activation and
  // batch dates stay in the developer's/admin's hands afterwards. Older
  // placeholder courses from an earlier, since-superseded catalog are
  // deactivated (never deleted, so any stray historical records keep their
  // foreign keys) rather than left visible on the public listing.
  let shortCoursesCreated = 0;
  let batchesCreated = 0;
  for (const sc of SHORT_COURSES) {
    let course = await db.shortCourse.findUnique({ where: { code: sc.code } });
    if (!course) {
      course = await db.shortCourse.create({ data: sc });
      shortCoursesCreated++;
    }
    for (const b of BATCH_STARTS) {
      const existingBatch = await db.shortCourseBatch.findUnique({
        where: { shortCourseId_label: { shortCourseId: course.id, label: b.label } },
      });
      if (existingBatch) continue;
      const startDate = new Date(`${b.startDate}T00:00:00.000Z`);
      const endDate = new Date(startDate.getTime() + course.durationWeeks * 7 * 86_400_000);
      await db.shortCourseBatch.create({
        data: { shortCourseId: course.id, label: b.label, startDate, endDate },
      });
      batchesCreated++;
    }
  }
  const legacyDeactivated = await db.shortCourse.updateMany({
    where: { code: { notIn: SHORT_COURSES.map((sc) => sc.code) }, active: true },
    data: { active: false },
  });
  if (shortCoursesCreated) log(`✓ ${shortCoursesCreated} short courses created`);
  if (batchesCreated) log(`✓ ${batchesCreated} short-course batches scheduled`);
  if (legacyDeactivated.count) log(`✓ ${legacyDeactivated.count} superseded short course(s) deactivated`);

  // 5. The Admission Form — a builder-manageable handle on the admission
  // application. Create-only: admins can then edit its intro, hide/show it
  // (status), relocate it (placement), or delete it. The specialized
  // application flow keeps its programme picker, AI results upload and fee
  // gating; this record only controls its visibility, intro and placement.
  const admissionForm = await db.formDef.findFirst({ where: { type: "ADMISSION" } });
  if (!admissionForm) {
    await db.formDef.create({
      data: {
        slug: "admission-application",
        title: "Admission Application",
        description:
          "Apply to a SYDA-GTIC flagship programme. Pay the application voucher to register, then complete your details, results and programme choices.",
        type: "ADMISSION",
        status: "PUBLISHED",
        placement: "PUBLIC_NAV",
      },
    });
    log("✓ admission form created (manageable from the form builder)");
  }

  // 6. Knowledge base for the AI assistant — create-only, chunked on create.
  let docsCreated = 0;
  for (const docDef of KNOWLEDGE_DOCS) {
    const existing = await db.knowledgeDocument.findUnique({ where: { slug: docDef.slug } });
    if (existing) continue;
    const doc = await db.knowledgeDocument.create({
      data: {
        slug: docDef.slug,
        title: docDef.title,
        category: docDef.category,
        sourceText: docDef.text.trim(),
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    const chunks = chunkDocument(doc.sourceText);
    await db.knowledgeChunk.createMany({
      data: chunks.map((c, i) => ({ documentId: doc.id, ord: i, heading: c.heading, content: c.content })),
    });
    docsCreated++;
  }
  if (docsCreated) log(`✓ ${docsCreated} knowledge documents published for the AI assistant`);
}
