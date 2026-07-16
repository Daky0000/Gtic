// SYDA-GTIC seed — real institution identity, roles/permissions, one demo
// user per role, the 5 real flagship training programmes, and a knowledge
// base matching the Center's actual admissions/handbook content.
// Idempotent: safe to run repeatedly.
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { chunkDocument } from "../src/lib/ai/chunker";
import {
  applicationRefNo, indexNumber, invoiceNo, staffNo, verificationCode,
  voucherPin, voucherSerial,
} from "../src/lib/codes";

const db = new PrismaClient();

// One account holding EVERY role — for exercising the whole system during
// testing before roles are divided across real staff (per project decision).
const SUPER_USER_EMAIL = "super@demo.campuscore.test";

// Local better-auth instance (no Next.js plugins) so seeded passwords use the
// exact same hashing as the running app.
const seedAuth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});

const DEMO_PASSWORD = "Password123!";

const ROLES: [code: string, name: string][] = [
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

const PERMISSIONS: [code: string, name: string, module: string][] = [
  ["admin.access", "Access the administration portal", "system"],
  ["users.manage", "Manage users and role assignments", "system"],
  ["institution.configure", "Configure institution identity and settings", "system"],
  ["knowledge.manage", "Manage the AI knowledge base", "ai"],
  ["ai.configure", "Configure AI features and budgets", "ai"],
  ["audit.view", "View the audit log", "system"],
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  developer: PERMISSIONS.map(([code]) => code),
  system_admin: PERMISSIONS.map(([code]) => code),
  registrar: ["knowledge.manage", "audit.view"],
  management: ["audit.view"],
};

// ── SYDA-GTIC's real academic structure: one School of Renewable Energy,
// five departments, each running one 3-month intensive diploma programme. ──
type Prog = { code: string; name: string; req?: string };
const STRUCTURE: { code: string; name: string; departments: { code: string; name: string; programmes: Prog[] }[] }[] = [
  {
    code: "SORE", name: "School of Renewable Energy",
    departments: [
      {
        code: "DSE", name: "Department of Solar Energy",
        programmes: [
          {
            code: "SENG", name: "Solar Energy Engineering",
            req: "Open to Senior High School graduates, technical/vocational certificate holders, and working professionals seeking hands-on solar PV skills. No fixed grade cut-offs are published — contact the admissions & training team to confirm your fit for this cohort.",
          },
        ],
      },
      {
        code: "DBE", name: "Department of Biogas & Biomass Engineering",
        programmes: [
          {
            code: "BENG", name: "Biogas & Biomass Engineering",
            req: "Open to Senior High School graduates, technical/vocational certificate holders, and working professionals seeking hands-on biogas plant and biomass skills. Contact the admissions & training team to confirm your fit for this cohort.",
          },
        ],
      },
      {
        code: "DWE", name: "Department of Wind Energy",
        programmes: [
          {
            code: "WENG", name: "Wind Energy Engineering",
            req: "Open to Senior High School graduates, technical/vocational certificate holders, and working professionals seeking hands-on wind turbine and site-assessment skills. Contact the admissions & training team to confirm your fit for this cohort.",
          },
        ],
      },
      {
        code: "DEV", name: "Department of Electric Vehicles",
        programmes: [
          {
            code: "EV", name: "Electric Vehicles",
            req: "Open to Senior High School graduates, technical/vocational certificate holders, and working professionals seeking hands-on EV powertrain and battery systems skills. Contact the admissions & training team to confirm your fit for this cohort.",
          },
        ],
      },
      {
        code: "DESS", name: "Department of Energy Storage Systems",
        programmes: [
          {
            code: "ESS", name: "Energy Storage Systems",
            req: "Open to Senior High School graduates, technical/vocational certificate holders, and working professionals seeking hands-on battery sizing and storage-system skills. Contact the admissions & training team to confirm your fit for this cohort.",
          },
        ],
      },
    ],
  },
];

// ── Knowledge base documents (published to the AI assistant) ──
const KNOWLEDGE_DOCS = [
  {
    slug: "trainee-handbook",
    title: "Trainee Handbook",
    category: "handbook",
    text: `
# About SYDA-GTIC
SYDA — Green Energy & Innovation Center (SYDA-GTIC) is a TVET/NVTI-accredited practical training center in Sunyani, Bono Region, Ghana, founded in 2019. Our mission is to train the African youth in practical renewable technologies for efficient deployment across residential, commercial and industrial environments. Our core values are Excellence, Transparency, Innovation and Integrity.

# Cohorts and Registration
Training runs in 3-month intensive cohorts: January–March (Solar Energy Engineering, Energy Storage Systems), May–July (Biogas & Biomass Engineering), and September–November (Wind Energy Engineering, Electric Vehicles). Two-week short courses (solar water pumping, solar water irrigation, solar water heating, kiln charcoal production) run in the gap months. Intake is year-round — an applicant can register any time and is placed into the next available cohort for their chosen programme.

# Fees and Payment
Each cohort has a published application (voucher) fee and a training fee covering tuition, workshop materials/PPE and certification. The application fee is paid online (card or mobile money) or by redeeming a pre-purchased application voucher. The training fee must be settled before the first day of the cohort. Payment can also be made at GCB Bank, Sunyani Branch, quoting your reference number.

# Accommodation
The Center does not provide residential accommodation. Trainees are responsible for arranging their own accommodation in Sunyani for the duration of their cohort; the admissions team can suggest nearby options on request.

# Practical Training and Safety
Because programmes are hands-on (workshop, plant, field and garage practicums), trainees must follow all safety instructions and wear the personal protective equipment (PPE) provided at all times in workshops, labs and field sites. Unsafe conduct around live electrical, biogas or battery equipment is grounds for suspension from practical sessions.

# Conduct
Trainees are expected to conduct themselves with honesty and respect. Assessment malpractice, damage to training equipment, harassment and unsafe conduct are disciplinary offences handled under the Center's disciplinary procedures and may result in suspension or dismissal from the cohort.
`,
  },
  {
    slug: "assessment-regulations",
    title: "Assessment & Certification Regulations",
    category: "exam-regulations",
    text: `
# Eligibility for Final Assessment
A trainee may sit the final assessment for a module only if they are registered for it and have attended the required minimum of practical sessions. Trainees with outstanding training fees beyond the approved threshold may be barred from final assessment.

# Assessment Format
Each module is assessed through continuous (practical/coursework) assessment and a final theory-and-practical assessment. Both are recorded and combined into a module score.

# Malpractice
Malpractice includes copying, impersonation, and unauthorised communication during an assessment. Alleged malpractice is recorded by the assessor and referred to the Assessments Office. Sanctions range from cancellation of the module result to dismissal from the cohort, depending on the gravity of the offence.

# Resit
A trainee who fails a module may register to resit it at the next available opportunity, on payment of the resit fee. A trainee may not receive their Certificate of Completion with an unresolved failed core module.

# Certification
On successful completion of all modules in a cohort, SYDA-GTIC issues a Certificate/Diploma of Completion as a downloadable PDF carrying a unique verification code that anyone can check on the Center's public verification page. Results are published after approval by the Head of Department and final sign-off by the Registrar; provisional results shared through any other channel have no official standing.
`,
  },
  {
    slug: "admissions-guide",
    title: "Admissions Guide",
    category: "admissions",
    text: `
# Who Can Apply
Admission is open to Senior High School graduates, technical/vocational certificate holders, and working professionals seeking practical upskilling in renewable energy or electric mobility. SYDA-GTIC does not publish fixed WASSCE grade cut-offs — the admissions & training team assesses each applicant's fit for their chosen programme individually and responds within two working days of enquiry.

# How to Apply
Applications are submitted online. An applicant pays the application (voucher) fee by card or mobile money, or redeems a pre-purchased application voucher; the system then creates their account automatically and shows them their login details once. The applicant then completes their application form and chosen programme, uploads supporting documents, and is placed into the next available cohort.

# Admission Letters and Fraud Warning
Successful applicants receive an official admission letter as a downloadable PDF carrying a unique verification code. Anyone can confirm a letter is genuine using the public verification page. The Center does not sell admission and never asks for payment to private accounts. Any letter that fails verification is fake and should be reported.

# Accepting an Offer
An admitted applicant accepts the offer online and pays the training fee within the stated deadline. Acceptance converts the applicant account into a trainee account for their cohort.

# Contact
SYDA Center, Sunyani, Bono Region, Ghana. Email hello@syda-geic.org or admissions@syda-geic.org. Office hours: Monday–Friday 8:00–17:00, Saturday 9:00–13:00.
`,
  },
];

// ── One-time migration off the old fictional-university demo content.
// Every delete is defensive: if real data (an actual applicant/student
// record, a booking, a live timetable session) still references an old row,
// that row is left in place and a warning is logged rather than forcing the
// delete through. Safe to run against a database that already has real
// production data mixed in with the old demo seed.
const OLD_PROGRAMME_CODES = [
  "BSC-CPE", "BSC-EEE", "BSC-CIV", "BSC-MEC", "BSC-REE", "BSC-PET", "BSC-MTH", "BSC-STA",
  "BSC-CHE", "BSC-NRM", "BSC-FAS", "BSC-AGR", "BSC-GLE", "BSC-REC", "BSC-MIN", "MSC-REN", "MPH-ENV",
];
const OLD_DEPARTMENT_CODES = ["CEE", "CVE", "MEC", "REE", "MAT", "CHS", "FRS", "FWR", "AGR", "GEO", "SSC", "MIN", "GRD"];
const OLD_SCHOOL_CODES = ["ENG", "SOE", "SOS", "SNR", "SAT", "SGS", "SASS", "SMBE", "SGSD"];
const OLD_COURSE_CODES = ["CPE 101", "MATH 101", "PHY 101", "ENG 101", "CPE 102", "MATH 102"];
const OLD_HOSTEL_NAMES = ["Unity Hall", "Hall of Grace", "International House"];
const OLD_VENUE_NAMES = ["Lecture Theatre A", "Lecture Theatre B", "Engineering Lab 1"];
const OLD_LIBRARY_TITLES = [
  "Introduction to Algorithms", "Fundamentals of Electric Circuits",
  "Calculus: Early Transcendentals", "University Physics",
  "Renewable Energy: Power for a Sustainable Future",
];
const OLD_CYCLE_NAME = "2026/2027 Undergraduate Admissions";
const OLD_ACADEMIC_YEAR_LABEL = "2026/2027";

async function cleanupLegacyDemoData() {
  for (const code of OLD_COURSE_CODES) {
    const course = await db.course.findUnique({ where: { code } });
    if (!course) continue;
    try {
      await db.prerequisite.deleteMany({ where: { OR: [{ courseId: course.id }, { requiresId: course.id }] } });
      await db.curriculumCourse.deleteMany({ where: { courseId: course.id } });
      const offerings = await db.courseOffering.findMany({ where: { courseId: course.id } });
      for (const o of offerings) {
        const liveUse = await db.registrationCourse.count({ where: { offeringId: o.id } });
        if (liveUse > 0) {
          console.warn(`  ! keeping legacy course ${code} — a real registration references its offering`);
          continue;
        }
        await db.offeringLecturer.deleteMany({ where: { offeringId: o.id } });
        await db.material.deleteMany({ where: { offeringId: o.id } });
        await db.courseOffering.delete({ where: { id: o.id } });
      }
      const remainingOfferings = await db.courseOffering.count({ where: { courseId: course.id } });
      if (remainingOfferings === 0) await db.course.delete({ where: { id: course.id } });
    } catch (e) {
      console.warn(`  ! could not remove legacy course ${code}:`, (e as Error).message);
    }
  }

  const oldProgrammes = await db.programme.findMany({ where: { code: { in: OLD_PROGRAMME_CODES } } });
  for (const p of oldProgrammes) {
    try {
      const [liveStudents, liveChoices, liveOffers] = await Promise.all([
        db.student.count({ where: { programmeId: p.id } }),
        db.applicationChoice.count({ where: { programmeId: p.id } }),
        db.offer.count({ where: { programmeId: p.id } }),
      ]);
      if (liveStudents > 0 || liveChoices > 0 || liveOffers > 0) {
        console.warn(`  ! keeping legacy programme ${p.code} — real records still reference it`);
        continue;
      }
      await db.cycleProgramme.deleteMany({ where: { programmeId: p.id } });
      await db.curriculumCourse.deleteMany({ where: { curriculum: { programmeId: p.id } } });
      await db.curriculumVersion.deleteMany({ where: { programmeId: p.id } });
      await db.programme.delete({ where: { id: p.id } });
    } catch (e) {
      console.warn(`  ! could not remove legacy programme ${p.code}:`, (e as Error).message);
    }
  }

  for (const code of OLD_DEPARTMENT_CODES) {
    const dept = await db.department.findUnique({ where: { code } });
    if (!dept) continue;
    try {
      const [remainingProgrammes, remainingCourses] = await Promise.all([
        db.programme.count({ where: { departmentId: dept.id } }),
        db.course.count({ where: { departmentId: dept.id } }),
      ]);
      if (remainingProgrammes > 0 || remainingCourses > 0) continue;
      await db.staffProfile.updateMany({ where: { departmentCode: code }, data: { departmentCode: "DBE" } });
      await db.department.delete({ where: { id: dept.id } });
    } catch (e) {
      console.warn(`  ! could not remove legacy department ${code}:`, (e as Error).message);
    }
  }

  for (const code of OLD_SCHOOL_CODES) {
    const school = await db.school.findUnique({ where: { code } });
    if (!school) continue;
    try {
      const remainingDepts = await db.department.count({ where: { schoolId: school.id } });
      if (remainingDepts > 0) continue;
      await db.school.delete({ where: { id: school.id } });
    } catch (e) {
      console.warn(`  ! could not remove legacy school ${code}:`, (e as Error).message);
    }
  }

  // Old admission cycle: Application rows are NEVER touched here — if a real
  // applicant applied under the old cycle, their application, choices and
  // documents are left fully intact and the cycle itself is kept.
  const oldCycle = await db.admissionCycle.findFirst({ where: { name: OLD_CYCLE_NAME } });
  if (oldCycle) {
    const liveApplications = await db.application.count({ where: { cycleId: oldCycle.id } });
    if (liveApplications === 0) {
      await db.voucher.deleteMany({ where: { cycleId: oldCycle.id } });
      await db.cycleProgramme.deleteMany({ where: { cycleId: oldCycle.id } });
      await db.admissionCycle.delete({ where: { id: oldCycle.id } });
    } else {
      console.warn(`  ! keeping legacy admission cycle — ${liveApplications} real application(s) reference it`);
    }
  }

  for (const name of OLD_HOSTEL_NAMES) {
    const hostel = await db.hostel.findUnique({ where: { name } });
    if (!hostel) continue;
    try {
      const liveBookings = await db.booking.count({ where: { bed: { room: { hostelId: hostel.id } } } });
      if (liveBookings > 0) {
        console.warn(`  ! keeping legacy hostel ${name} — real bookings reference it`);
        continue;
      }
      await db.hostel.delete({ where: { id: hostel.id } }); // cascades rooms/beds
    } catch (e) {
      console.warn(`  ! could not remove legacy hostel ${name}:`, (e as Error).message);
    }
  }

  for (const name of OLD_VENUE_NAMES) {
    const venue = await db.venue.findUnique({ where: { name } });
    if (!venue) continue;
    try {
      const liveSessions = await db.timetableSession.count({ where: { venueId: venue.id } });
      if (liveSessions > 0) continue;
      await db.venue.delete({ where: { id: venue.id } });
    } catch (e) {
      console.warn(`  ! could not remove legacy venue ${name}:`, (e as Error).message);
    }
  }

  await db.libraryItem.deleteMany({
    where: { title: { in: OLD_LIBRARY_TITLES }, loans: { none: {} } },
  });

  const oldYear = await db.academicYear.findUnique({ where: { label: OLD_ACADEMIC_YEAR_LABEL } });
  if (oldYear) {
    try {
      const [liveStudentsInYear, liveCyclesInYear, liveSchedules] = await Promise.all([
        db.student.count({ where: { entryYearId: oldYear.id } }),
        db.admissionCycle.count({ where: { academicYearId: oldYear.id } }),
        db.feeSchedule.count({ where: { academicYearId: oldYear.id } }),
      ]);
      if (liveStudentsInYear === 0 && liveCyclesInYear === 0 && liveSchedules === 0) {
        await db.semester.deleteMany({ where: { academicYearId: oldYear.id } });
        await db.academicYear.delete({ where: { id: oldYear.id } });
      }
    } catch (e) {
      console.warn(`  ! could not remove legacy academic year:`, (e as Error).message);
    }
  }
}

async function main() {
  console.log("Seeding SYDA-GTIC…");

  // 0. Migrate off the old fictional-university demo content, if present.
  await cleanupLegacyDemoData();
  console.log("  ✓ legacy demo content migrated (see any warnings above)");

  // 1. Institution — create, or rebrand an existing row (e.g. from an older
  // seed run) to the real institution identity.
  const institutionData = {
    name: "SYDA — Green Energy & Innovation Center",
    shortName: "SYDA-GTIC",
    motto: "Training the engineers who power Africa's renewable future",
    address: "SYDA Center, Sunyani, Bono Region, Ghana",
    contactEmail: "hello@syda-geic.org",
    contactPhone: "+233 00 000 0000",
    website: "https://gticglobal.com",
  };
  const inst = await db.institution.findFirst();
  if (!inst) {
    await db.institution.create({ data: institutionData });
    console.log("  ✓ institution");
  } else if (inst.shortName !== institutionData.shortName) {
    await db.institution.update({ where: { id: inst.id }, data: institutionData });
    console.log("  ✓ institution rebranded to SYDA-GTIC");
  }

  // 2. Roles + permissions
  for (const [code, name] of ROLES) {
    await db.role.upsert({ where: { code }, update: { name }, create: { code, name } });
  }
  for (const [code, name, module] of PERMISSIONS) {
    await db.permission.upsert({ where: { code }, update: { name, module }, create: { code, name, module } });
  }
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await db.role.findUniqueOrThrow({ where: { code: roleCode } });
    for (const permCode of permCodes) {
      const perm = await db.permission.findUniqueOrThrow({ where: { code: permCode } });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }
  console.log(`  ✓ ${ROLES.length} roles, ${PERMISSIONS.length} permissions`);

  // 3. Demo users — one per role, password identical for all demo accounts.
  for (const [code, name] of ROLES) {
    const email = `${code.replace(/_/g, ".")}@demo.campuscore.test`;
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      await seedAuth.api.signUpEmail({
        body: { email, password: DEMO_PASSWORD, name: `Demo ${name}` },
      });
      user = await db.user.findUniqueOrThrow({ where: { email } });
      await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }
    const role = await db.role.findUniqueOrThrow({ where: { code } });
    const existing = await db.roleAssignment.findFirst({
      where: { userId: user.id, roleId: role.id },
    });
    if (!existing) {
      await db.roleAssignment.create({ data: { userId: user.id, roleId: role.id } });
    }
  }
  console.log(`  ✓ ${ROLES.length} demo users (password: ${DEMO_PASSWORD})`);

  // 3b. Super user — holds every role, for testing the whole system before
  // roles are divided across real staff.
  let superUser = await db.user.findUnique({ where: { email: SUPER_USER_EMAIL } });
  if (!superUser) {
    await seedAuth.api.signUpEmail({
      body: { email: SUPER_USER_EMAIL, password: DEMO_PASSWORD, name: "Super Admin" },
    });
    superUser = await db.user.findUniqueOrThrow({ where: { email: SUPER_USER_EMAIL } });
    await db.user.update({ where: { id: superUser.id }, data: { emailVerified: true } });
  }
  for (const [code] of ROLES) {
    const role = await db.role.findUniqueOrThrow({ where: { code } });
    const existing = await db.roleAssignment.findFirst({
      where: { userId: superUser.id, roleId: role.id },
    });
    if (!existing) {
      await db.roleAssignment.create({ data: { userId: superUser.id, roleId: role.id } });
    }
  }
  console.log(`  ✓ super user ${SUPER_USER_EMAIL} holds all ${ROLES.length} roles`);

  // 4. Academic structure — 1 diploma-level, 1-semester (3-month) programme
  // per department, matching the Center's real flagship cohorts.
  for (const s of STRUCTURE) {
    const school = await db.school.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: { code: s.code, name: s.name },
    });
    for (const d of s.departments) {
      const dept = await db.department.upsert({
        where: { code: d.code },
        update: { name: d.name, schoolId: school.id },
        create: { code: d.code, name: d.name, schoolId: school.id },
      });
      for (const p of d.programmes) {
        await db.programme.upsert({
          where: { code: p.code },
          update: { name: p.name, entryRequirements: p.req ?? null },
          create: {
            code: p.code,
            name: p.name,
            level: "DIPLOMA",
            durationSemesters: 1,
            departmentId: dept.id,
            entryRequirements: p.req ?? null,
          },
        });
      }
    }
  }
  console.log(`  ✓ academic structure (School of Renewable Energy, 5 departments/programmes)`);

  // 5. Knowledge base — create/update, chunk, publish.
  for (const docDef of KNOWLEDGE_DOCS) {
    const doc = await db.knowledgeDocument.upsert({
      where: { slug: docDef.slug },
      update: { title: docDef.title, category: docDef.category, sourceText: docDef.text.trim(), status: "PUBLISHED", publishedAt: new Date() },
      create: { slug: docDef.slug, title: docDef.title, category: docDef.category, sourceText: docDef.text.trim(), status: "PUBLISHED", publishedAt: new Date() },
    });
    const chunks = chunkDocument(doc.sourceText);
    await db.$transaction([
      db.knowledgeChunk.deleteMany({ where: { documentId: doc.id } }),
      db.knowledgeChunk.createMany({
        data: chunks.map((c, i) => ({ documentId: doc.id, ord: i, heading: c.heading, content: c.content })),
      }),
    ]);
  }
  console.log(`  ✓ ${KNOWLEDGE_DOCS.length} knowledge documents published and indexed`);

  // 6. AI feature configuration
  await db.aIFeatureConfig.upsert({
    where: { feature: "assistant" },
    update: {},
    create: {
      feature: "assistant",
      enabled: true,
      provider: "auto",
      model: "claude-opus-4-8",
      effort: "low",
      monthlyTokenBudget: 5_000_000,
    },
  });
  console.log("  ✓ AI feature config (assistant)");

  // 7. Academic calendar — real 2026 cohort dates. The May–Jul Biogas &
  // Biomass cohort is the one "in session" (registration/add-drop already
  // closed, an assessment window open) so staff/trainee features are
  // demonstrable now; separately, admissions are open for the *next*
  // upcoming cohort (step 8) — the two need not be the same intake.
  const year = await db.academicYear.upsert({
    where: { label: "2026" },
    update: { isCurrent: true },
    create: {
      label: "2026",
      startsOn: new Date("2026-01-01"),
      endsOn: new Date("2026-12-31"),
      isCurrent: true,
    },
  });

  const semester1 = await db.semester.upsert({
    where: { academicYearId_number: { academicYearId: year.id, number: 2 } },
    update: { isCurrent: true },
    create: {
      academicYearId: year.id,
      number: 2,
      label: "May–Jul 2026 — Biogas & Biomass Engineering Cohort",
      startsOn: new Date("2026-05-01"),
      endsOn: new Date("2026-07-31"),
      isCurrent: true,
    },
  });

  for (const w of [
    { type: "REGISTRATION" as const, opensAt: new Date("2026-04-20"), closesAt: new Date("2026-05-10") },
    { type: "ADD_DROP" as const, opensAt: new Date("2026-04-20"), closesAt: new Date("2026-05-17") },
    { type: "EVALUATION" as const, opensAt: new Date("2026-07-10"), closesAt: new Date("2026-07-31") },
  ]) {
    await db.window.upsert({
      where: { semesterId_type: { semesterId: semester1.id, type: w.type } },
      update: { opensAt: w.opensAt, closesAt: w.closesAt },
      create: { semesterId: semester1.id, ...w },
    });
  }
  console.log("  ✓ academic calendar (2026, Biogas & Biomass cohort in session)");

  // 8. Admission cycle for the next upcoming cohort, quotas and a voucher
  // batch. The application voucher is GHS 50; the acceptance fee is a
  // placeholder — adjust either any time from Admin > Fees.
  const admittedProgrammes = ["WENG", "EV"];
  let cycle = await db.admissionCycle.findFirst({ where: { name: "September–November 2026 Admissions" } });
  if (cycle) {
    // Re-seeding an existing database: bring the fee in line with GHS 50.
    cycle = await db.admissionCycle.update({ where: { id: cycle.id }, data: { applicationFee: 5000 } });
  } else {
    cycle = await db.admissionCycle.create({
      data: {
        name: "September–November 2026 Admissions",
        academicYearId: year.id,
        opensAt: new Date("2026-07-01"),
        closesAt: new Date("2026-08-25"),
        applicationFee: 5000, // GHS 50 application voucher
        acceptanceFee: 20000, // GHS 200 (placeholder)
        status: "OPEN",
      },
    });
    for (const code of admittedProgrammes) {
      const programme = await db.programme.findUniqueOrThrow({ where: { code } });
      await db.cycleProgramme.create({
        data: { cycleId: cycle.id, programmeId: programme.id, quota: 25 },
      });
    }
  }
  const existingVouchers = await db.voucher.count({ where: { cycleId: cycle.id } });
  const demoVoucher = { serial: "VDEMO001", pin: "12345678" };
  if (existingVouchers === 0) {
    // The fixed demo serial may already exist on a preserved legacy cycle
    // (e.g. one kept because real applications still reference it) — in
    // that case just skip it rather than collide on the unique constraint.
    const serialTaken = await db.voucher.findUnique({ where: { serial: demoVoucher.serial } });
    if (!serialTaken) {
      await db.voucher.create({ data: { cycleId: cycle.id, ...demoVoucher, status: "GENERATED" } });
    }
    for (let i = 0; i < 4; i++) {
      await db.voucher.create({
        data: { cycleId: cycle.id, serial: voucherSerial(), pin: voucherPin(), status: "GENERATED" },
      });
    }
  }
  console.log(`  ✓ admission cycle open for Wind Energy Engineering & Electric Vehicles (demo voucher ${demoVoucher.serial} / PIN ${demoVoucher.pin} — if available)`);

  // 9. Courses + prerequisites + curriculum for the in-session cohort
  // (Biogas & Biomass Engineering).
  const dbeDept = await db.department.findUniqueOrThrow({ where: { code: "DBE" } });
  const beng = await db.programme.findUniqueOrThrow({ where: { code: "BENG" } });

  const courseDefs = [
    { code: "BENG 101", title: "Fundamentals of Anaerobic Digestion", credits: 3, sem: 1 },
    { code: "BENG 102", title: "Feedstock Management & Pre-treatment", credits: 3, sem: 1 },
    { code: "BENG 103", title: "Biogas Safety, Operations & Maintenance", credits: 2, sem: 1 },
    { code: "BENG 104", title: "Biogas Plant Design & Sizing", credits: 3, sem: 1, requires: "BENG 101" },
    { code: "BENG 105", title: "CHP Integration & Plant Practicum", credits: 4, sem: 1, requires: "BENG 104" },
  ];
  const courseIds: Record<string, string> = {};
  for (const c of courseDefs) {
    const course = await db.course.upsert({
      where: { code: c.code },
      update: { title: c.title, credits: c.credits, departmentId: dbeDept.id },
      create: { code: c.code, title: c.title, credits: c.credits, departmentId: dbeDept.id },
    });
    courseIds[c.code] = course.id;
  }
  for (const c of courseDefs) {
    if (c.requires) {
      await db.prerequisite.upsert({
        where: { courseId_requiresId: { courseId: courseIds[c.code], requiresId: courseIds[c.requires] } },
        update: {},
        create: { courseId: courseIds[c.code], requiresId: courseIds[c.requires] },
      });
    }
  }

  const curriculum = await db.curriculumVersion.upsert({
    where: { programmeId_name: { programmeId: beng.id, name: "2026 cohort" } },
    update: { minCredits: 10, maxCredits: 15 },
    create: { programmeId: beng.id, name: "2026 cohort", minCredits: 10, maxCredits: 15 },
  });
  for (const c of courseDefs) {
    await db.curriculumCourse.upsert({
      where: { curriculumId_courseId: { curriculumId: curriculum.id, courseId: courseIds[c.code] } },
      update: { semesterNumber: c.sem, type: "CORE" },
      create: { curriculumId: curriculum.id, courseId: courseIds[c.code], semesterNumber: c.sem, type: "CORE" },
    });
  }
  console.log(`  ✓ ${courseDefs.length} modules + curriculum "2026 cohort" for Biogas & Biomass Engineering`);

  // 10. Fee schedule for the academic year
  const feeSchedule = await db.feeSchedule.upsert({
    where: { academicYearId_level: { academicYearId: year.id, level: "DIPLOMA" } },
    update: {},
    create: { academicYearId: year.id, level: "DIPLOMA", name: "2026 Training Cohort Fees" },
  });
  const feeItemCount = await db.feeItem.count({ where: { scheduleId: feeSchedule.id } });
  if (feeItemCount === 0) {
    await db.feeItem.createMany({
      data: [
        { scheduleId: feeSchedule.id, name: "Training Fee", amount: 250_000 }, // GHS 2,500 (placeholder)
        { scheduleId: feeSchedule.id, name: "Workshop Materials & PPE Fee", amount: 30_000 }, // GHS 300 (placeholder)
        { scheduleId: feeSchedule.id, name: "Certification & Assessment Fee", amount: 20_000 }, // GHS 200 (placeholder)
      ],
    });
  }
  console.log("  ✓ 2026 training cohort fee schedule (GHS 3,000.00 per cohort — placeholder, adjust in Admin > Fees)");

  // 11. Course offerings for the in-session cohort, with instructors assigned
  const lecturerUser = await db.user.findUniqueOrThrow({ where: { email: "lecturer@demo.campuscore.test" } });
  const offeringIds: Record<string, string> = {};
  for (const c of courseDefs.filter((c) => c.sem === 1)) {
    const offering = await db.courseOffering.upsert({
      where: { courseId_semesterId: { courseId: courseIds[c.code], semesterId: semester1.id } },
      update: {},
      create: { courseId: courseIds[c.code], semesterId: semester1.id, capacity: 25 },
    });
    offeringIds[c.code] = offering.id;
    for (const staffUserId of [lecturerUser.id, superUser.id]) {
      await db.offeringLecturer.upsert({
        where: { offeringId_staffUserId: { offeringId: offering.id, staffUserId } },
        update: {},
        create: { offeringId: offering.id, staffUserId },
      });
    }
  }
  console.log(`  ✓ ${Object.keys(offeringIds).length} module offerings for the current cohort, instructors assigned`);

  // 12. Enroll the demo trainee and the super user as real trainees — or
  // migrate them onto the new programme if they were seeded under the old
  // demo structure (this is seeded demo data, safe to move).
  for (const email of ["student@demo.campuscore.test", SUPER_USER_EMAIL]) {
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    const already = await db.student.findUnique({ where: { userId: u.id } });
    if (!already) {
      await db.student.create({
        data: {
          userId: u.id,
          indexNo: indexNumber(year.label),
          programmeId: beng.id,
          curriculumVersionId: curriculum.id,
          entryYearId: year.id,
          status: "ACTIVE",
        },
      });
    } else if (already.programmeId !== beng.id) {
      await db.student.update({
        where: { id: already.id },
        data: { programmeId: beng.id, curriculumVersionId: curriculum.id, entryYearId: year.id },
      });
    }
  }
  console.log("  ✓ demo trainee + super user enrolled in Biogas & Biomass Engineering");

  // 13. Venues — named for each programme's real hands-on training format
  for (const v of [
    { name: "Solar PV Workshop", capacity: 25 },
    { name: "Biogas Plant & Lab", capacity: 25 },
    { name: "Wind Turbine Test Field", capacity: 20 },
    { name: "EV Garage & Powertrain Bay", capacity: 15 },
    { name: "Battery & Energy Storage Lab", capacity: 20 },
  ]) {
    await db.venue.upsert({ where: { name: v.name }, update: {}, create: v });
  }
  console.log("  ✓ venues");

  // 14. Accommodation is not provided by the Center (not part of its
  // published offering) — the module stays available but unseeded.

  // 15. Library items — real, relevant renewable-energy reference texts
  const bookCount = await db.libraryItem.count();
  if (bookCount === 0) {
    await db.libraryItem.createMany({
      data: [
        { title: "Solar Engineering of Thermal Processes", author: "Duffie & Beckman", copiesTotal: 3, copiesAvailable: 3 },
        { title: "The Biogas Handbook: Science, Production and Applications", author: "Wellinger, Murphy & Baxter (eds.)", copiesTotal: 3, copiesAvailable: 3 },
        { title: "Wind Energy Explained: Theory, Design and Application", author: "Manwell, McGowan & Rogers", copiesTotal: 3, copiesAvailable: 3 },
        { title: "Electric Vehicle Technology Explained", author: "Larminie & Lowry", copiesTotal: 3, copiesAvailable: 3 },
        { title: "Battery Management Systems for Large Lithium-Ion Battery Packs", author: "Andrea", copiesTotal: 2, copiesAvailable: 2 },
      ],
    });
  }
  console.log("  ✓ library catalogue");

  // 16. Staff profiles (HR)
  const staffEmails = ["lecturer@demo.campuscore.test", "hod@demo.campuscore.test", "dean@demo.campuscore.test"];
  for (const email of staffEmails) {
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    const existing = await db.staffProfile.findUnique({ where: { userId: u.id } });
    if (!existing) {
      await db.staffProfile.create({
        data: { userId: u.id, staffNo: staffNo(), position: u.name.replace("Demo ", ""), departmentCode: "DBE", hiredOn: new Date("2023-01-01") },
      });
    }
  }
  const superStaff = await db.staffProfile.findUnique({ where: { userId: superUser.id } });
  if (!superStaff) {
    await db.staffProfile.create({
      data: { userId: superUser.id, staffNo: staffNo(), position: "Super Admin", departmentCode: "DBE", hiredOn: new Date("2023-01-01") },
    });
  }
  console.log("  ✓ staff HR profiles");

  // 17. Welcome announcement
  const announcementCount = await db.announcement.count();
  if (announcementCount === 0) {
    await db.announcement.create({
      data: {
        title: "Applications open — September–November 2026 cohort",
        body: "Wind Energy Engineering and Electric Vehicles applications are now open for the September–November 2026 cohort. Pay your application voucher fee online to register — spaces are limited.",
        audience: "ALL",
      },
    });
  }
  console.log("  ✓ welcome announcement");

  console.log("Seed complete.");
  console.log(`\nSuper user login: ${SUPER_USER_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
