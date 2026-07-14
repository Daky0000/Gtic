// CampusCore Phase 0 seed — demo institution, roles/permissions, one demo user
// per role, UENR-like academic structure, and a published knowledge base.
// Idempotent: safe to run repeatedly.
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { chunkDocument } from "../src/lib/ai/chunker";

const db = new PrismaClient();

// Local better-auth instance (no Next.js plugins) so seeded passwords use the
// exact same hashing as the running app.
const seedAuth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});

const DEMO_PASSWORD = "Password123!";

const ROLES: [code: string, name: string][] = [
  ["applicant", "Prospective Applicant"],
  ["student", "Student"],
  ["lecturer", "Lecturer"],
  ["hod", "Head of Department"],
  ["dean", "Dean of School"],
  ["admissions_officer", "Admissions Officer"],
  ["registrar", "Registrar / Academic Affairs"],
  ["exams_officer", "Examinations Officer"],
  ["finance_officer", "Finance Officer"],
  ["accommodation_manager", "Accommodation Manager"],
  ["librarian", "Librarian"],
  ["hr_officer", "HR Officer"],
  ["grad_school_officer", "Graduate School Officer"],
  ["counsellor", "Counsellor / Student Affairs"],
  ["qa_officer", "Quality Assurance Officer"],
  ["management", "University Management"],
  ["alumni", "Alumnus/Alumna"],
  ["system_admin", "System Administrator"],
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
  system_admin: PERMISSIONS.map(([code]) => code),
  registrar: ["knowledge.manage", "audit.view"],
  management: ["audit.view"],
};

// ── UENR-inspired demo academic structure ──
type Prog = { code: string; name: string; level?: "UNDERGRADUATE" | "POSTGRADUATE"; years?: number; req?: string };
const STRUCTURE: { code: string; name: string; departments: { code: string; name: string; programmes: Prog[] }[] }[] = [
  {
    code: "ENG", name: "School of Engineering",
    departments: [
      {
        code: "CEE", name: "Department of Computer and Electrical Engineering",
        programmes: [
          { code: "BSC-CPE", name: "BSc Computer Engineering", req: "WASSCE credits (A1–C6) in English, Core Mathematics and Integrated Science, plus Physics, Chemistry and Elective Mathematics. Competitive aggregate 36 or better." },
          { code: "BSC-EEE", name: "BSc Electrical and Electronic Engineering", req: "WASSCE credits (A1–C6) in English, Core Mathematics and Integrated Science, plus Physics, Chemistry and Elective Mathematics." },
        ],
      },
      {
        code: "CVE", name: "Department of Civil and Environmental Engineering",
        programmes: [
          { code: "BSC-CIV", name: "BSc Civil Engineering", req: "WASSCE credits in core subjects plus Physics, Chemistry and Elective Mathematics." },
        ],
      },
      {
        code: "MEC", name: "Department of Mechanical Engineering",
        programmes: [
          { code: "BSC-MEC", name: "BSc Mechanical Engineering", req: "WASSCE credits in core subjects plus Physics, Chemistry and Elective Mathematics." },
        ],
      },
    ],
  },
  {
    code: "SOE", name: "School of Energy",
    departments: [
      {
        code: "REE", name: "Department of Renewable Energy Engineering",
        programmes: [
          { code: "BSC-REE", name: "BSc Renewable Energy Engineering", req: "WASSCE credits in core subjects plus Physics, Chemistry and Elective Mathematics." },
          { code: "BSC-PET", name: "BSc Petroleum and Natural Gas Engineering", req: "WASSCE credits in core subjects plus Physics, Chemistry and Elective Mathematics." },
        ],
      },
    ],
  },
  {
    code: "SOS", name: "School of Sciences",
    departments: [
      {
        code: "MAT", name: "Department of Mathematics and Statistics",
        programmes: [
          { code: "BSC-MTH", name: "BSc Mathematics", req: "WASSCE credits in core subjects plus Elective Mathematics and one of Physics, Chemistry, Economics." },
          { code: "BSC-STA", name: "BSc Statistics", req: "WASSCE credits in core subjects plus Elective Mathematics." },
        ],
      },
      {
        code: "CHS", name: "Department of Chemical Sciences",
        programmes: [
          { code: "BSC-CHE", name: "BSc Chemistry", req: "WASSCE credits in core subjects plus Chemistry, Physics and Elective Mathematics or Biology." },
        ],
      },
    ],
  },
  {
    code: "SNR", name: "School of Natural Resources",
    departments: [
      {
        code: "FRS", name: "Department of Forest Science",
        programmes: [
          { code: "BSC-NRM", name: "BSc Natural Resources Management", req: "WASSCE credits in core subjects plus two of Biology, Chemistry, Physics, Geography, Economics." },
        ],
      },
      {
        code: "FWR", name: "Department of Fisheries and Water Resources",
        programmes: [
          { code: "BSC-FAS", name: "BSc Fisheries and Aquatic Sciences", req: "WASSCE credits in core subjects plus Biology and one other science elective." },
        ],
      },
    ],
  },
  {
    code: "SAT", name: "School of Agriculture and Technology",
    departments: [
      {
        code: "AGR", name: "Department of Agriculture",
        programmes: [
          { code: "BSC-AGR", name: "BSc Agriculture", req: "WASSCE credits in core subjects plus two science electives (General Agriculture accepted)." },
        ],
      },
    ],
  },
  {
    code: "SGS", name: "School of Geosciences",
    departments: [
      {
        code: "GEO", name: "Department of Geological Engineering",
        programmes: [
          { code: "BSC-GLE", name: "BSc Geological Engineering", req: "WASSCE credits in core subjects plus Physics, Chemistry and Elective Mathematics." },
        ],
      },
    ],
  },
  {
    code: "SASS", name: "School of Arts and Social Sciences",
    departments: [
      {
        code: "SSC", name: "Department of Social Sciences",
        programmes: [
          { code: "BSC-REC", name: "BSc Resource Economics", req: "WASSCE credits in core subjects plus Economics and one of Elective Mathematics, Geography, Business Management." },
        ],
      },
    ],
  },
  {
    code: "SMBE", name: "School of Mines and Built Environment",
    departments: [
      {
        code: "MIN", name: "Department of Mining Engineering",
        programmes: [
          { code: "BSC-MIN", name: "BSc Mining Engineering", req: "WASSCE credits in core subjects plus Physics, Chemistry and Elective Mathematics." },
        ],
      },
    ],
  },
  {
    code: "SGSD", name: "School of Graduate Studies",
    departments: [
      {
        code: "GRD", name: "Graduate Programmes Office",
        programmes: [
          { code: "MSC-REN", name: "MSc Renewable Energy Technologies", level: "POSTGRADUATE", years: 1, req: "A good first degree (Second Class Lower or better) in engineering or the physical sciences." },
          { code: "MPH-ENV", name: "MPhil Environmental Science", level: "POSTGRADUATE", years: 2, req: "A good first degree in a relevant science discipline; research proposal required." },
        ],
      },
    ],
  },
];

// ── Knowledge base documents (published to the AI assistant) ──
const KNOWLEDGE_DOCS = [
  {
    slug: "student-handbook",
    title: "Student Handbook (Demo Extract)",
    category: "handbook",
    text: `
# About the University
CampusCore Demo University is a public university focused on energy, natural resources and applied sciences. It operates nine schools across three campuses. This handbook summarises the rules every student agrees to at enrollment.

# Registration
Every student must register their courses online each semester within the registration window published in the academic calendar. Late registration attracts a penalty fee and requires approval. A student who does not register by the end of the add/drop window is deemed to have deferred the semester. The normal load is between 15 and 21 credit hours per semester; registering above or below this range requires the approval of the Head of Department.

# Grading System
The university uses the Cumulative Weighted Average (CWA) system. Each course score out of 100 is weighted by its credit hours. Class boundaries are: First Class — CWA of 70.00 and above; Second Class Upper — 60.00 to 69.99; Second Class Lower — 50.00 to 59.99; Pass — 40.00 to 49.99. A course mark below 40 is a fail and the course must be retaken or resat.

# Academic Standing
A student whose CWA falls below 40 at the end of an academic year is placed on academic probation for the following year. A student on probation whose CWA remains below 40 after the probation year may be withdrawn from the university. Students in good standing are those with a CWA of 40 or above.

# Fees and Payment
Fees for each academic year are published before the year begins. A student must pay at least seventy percent (70%) of the semester bill before they can register courses. The remaining balance must be settled before end-of-semester examinations. Payment can be made online by card or mobile money, or at designated banks with a pay-in slip.

# Accommodation
University hostel places are limited and are allocated through the online booking system on a first-come basis within each eligibility window. A booked bed is forfeited if the hostel fee is not paid within five (5) working days of booking.

# Conduct
Students are expected to conduct themselves with honesty and respect. Examination malpractice, plagiarism, harassment and vandalism are disciplinary offences handled under the university's disciplinary procedures and may result in suspension or dismissal.
`,
  },
  {
    slug: "exam-regulations",
    title: "Examination Regulations (Demo Extract)",
    category: "exam-regulations",
    text: `
# Eligibility to Sit Examinations
A student may sit an end-of-semester examination only if they are duly registered for the course and have attended at least seventy percent (70%) of lectures. Students with outstanding fees beyond the approved threshold may be barred from the examination hall.

# Conduct in the Examination Hall
Candidates must present a valid student identity card. No unauthorised materials, phones or smart devices are permitted at the seat. Candidates arriving more than thirty minutes after the start of a paper are not admitted. Leaving the hall within the first thirty minutes is not permitted.

# Examination Malpractice
Malpractice includes possession of unauthorised material, copying, impersonation, and communication with other candidates. Alleged malpractice is recorded by the invigilator and referred to the Examinations Malpractice Committee. Sanctions range from cancellation of the paper to dismissal from the university, depending on the gravity of the offence. Affected results are withheld until the case is determined.

# Resit and Supplementary Examinations
A student who fails a course (mark below 40) may register to resit the examination at the next available opportunity, subject to payment of the resit fee. The maximum mark obtainable in a resit examination is capped at fifty (50). A student may not graduate with an unresolved failed core course.

# Remarking and Review of Results
A student who is dissatisfied with a published result may apply for a formal remark within fourteen (14) days of publication, on payment of the remark fee. The script is remarked by an independent second examiner. If the remark changes the grade, the new grade stands and the fee is refunded. Frivolous applications are not refunded.

# Publication of Results
Results are published to student portals after approval by the Head of Department, the Dean, the Examinations Office and final sign-off by the Registrar. Provisional results circulated by any other channel have no official standing.
`,
  },
  {
    slug: "admissions-guide",
    title: "Admissions Guide (Demo Extract)",
    category: "admissions",
    text: `
# Who Can Apply
Admission is open to WASSCE holders, mature applicants (25 years and above with relevant work experience), international applicants with equivalent qualifications, and graduate applicants for postgraduate programmes.

# General Entry Requirements (Undergraduate)
Applicants must hold WASSCE credits (grades A1 to C6) in three core subjects — English Language, Core Mathematics and Integrated Science — plus three elective subjects relevant to the chosen programme. Engineering programmes require Physics, Chemistry and Elective Mathematics as electives. A competitive aggregate of 36 or better is expected; some programmes publish lower cut-offs.

# How to Apply
Applications are submitted online through the admissions portal. An applicant creates an account, pays the application fee online (card or mobile money) or redeems a pre-purchased application voucher, completes the application form, uploads results slips and documents, and submits before the deadline. The portal shows the live status of the application at every stage.

# Admission Letters and Fraud Warning
Successful applicants receive an official admission letter as a downloadable PDF carrying a unique verification code. Anyone can confirm a letter is genuine using the public verification page. The university does not sell admission and never asks for payment to private accounts. Any letter that fails verification is fake and should be reported.

# Accepting an Offer
An admitted applicant accepts the offer online and pays the acceptance fee within the stated deadline. Acceptance converts the applicant account into a student account; enrollment instructions, medical forms and the hostel booking window follow by email and SMS.
`,
  },
];

async function main() {
  console.log("Seeding CampusCore…");

  // 1. Institution
  const inst = await db.institution.findFirst();
  if (!inst) {
    await db.institution.create({
      data: {
        name: "CampusCore Demo University",
        shortName: "CDU",
        motto: "Powering the future through knowledge and innovation",
        address: "P.O. Box 214, Sunyani, Bono Region, Ghana (demo)",
        contactEmail: "info@demo.campuscore.test",
        contactPhone: "+233 00 000 0000",
        website: "https://demo.campuscore.test",
      },
    });
    console.log("  ✓ institution");
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

  // 4. Academic structure
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
            level: p.level ?? "UNDERGRADUATE",
            durationSemesters: (p.years ?? 4) * 2,
            departmentId: dept.id,
            entryRequirements: p.req ?? null,
          },
        });
      }
    }
  }
  console.log(`  ✓ academic structure (${STRUCTURE.length} schools)`);

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

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
