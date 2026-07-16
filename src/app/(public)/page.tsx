import Link from "next/link";
import { db } from "@/lib/db";
import { programmeTint, programmeCode } from "@/lib/programme-style";

// Dynamic (not ISR): avoids requiring a database connection at build time,
// and institution/announcement data should never be frozen from a build.
export const dynamic = "force-dynamic";

const FOUNDED_YEAR = 2019;

const VALUES = [
  { n: "01", name: "Excellence" },
  { n: "02", name: "Transparency" },
  { n: "03", name: "Innovation" },
  { n: "04", name: "Integrity" },
];

const PARTNERS = ["UENR", "NVTI", "TVET", "RCEES", "RES4Africa", "KNUST"];

const STAGES = [
  { n: "01", title: "Apply & enrol", body: "Admissions run year-round and close one month before each cohort. Open to JHS through PhD, ages 16–50." },
  { n: "02", title: "Train hands-on", body: "Four progressive modules — from electrical fundamentals to full system installation on real equipment." },
  { n: "03", title: "Field & industry", body: "Field trips, industrial visits, internships and attachments place trainees on live sites." },
  { n: "04", title: "Certify & deploy", body: "Graduate with a recognised TVET/NVTI credential and the competence to deploy anywhere." },
];

export default async function HomePage() {
  const [institution, programmeCount, programmes, announcements] = await Promise.all([
    db.institution.findFirst(),
    db.programme.count(),
    db.programme.findMany({
      orderBy: { name: "asc" },
      take: 6,
      include: { department: true },
    }),
    db.announcement.findMany({
      where: { audience: "ALL" },
      orderBy: { publishedAt: "desc" },
      take: 2,
    }),
  ]);

  const name = institution?.name ?? "SYDA — Green Energy & Innovation Center";
  const motto = institution?.motto ?? "Training the engineers who power Africa's renewable future.";
  const years = new Date().getFullYear() - FOUNDED_YEAR;

  const stats = [
    { n: String(programmeCount || 5), label: "Flagship training programmes across the energy mix" },
    { n: String(years), label: "Years training Africa's renewable energy engineers" },
    { n: "24/7", label: "AI assistant for applicants and trainees" },
  ];

  return (
    <div className="scr">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden bg-forest-deep text-[#f3f1e8]">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_85%_0%,rgba(59,122,84,.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px)] bg-[length:100%_46px] opacity-50" />
        <div className="relative mx-auto max-w-[1200px] px-7 pt-[90px]">
          <div className="grid items-end gap-14 md:grid-cols-[1.12fr_0.88fr]">
            <div className="pb-16">
              <div className="mb-[26px] inline-flex items-center gap-[9px] font-mono text-[12px] uppercase tracking-[0.1em] text-[#a9c7b2]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7fb894]" />
                School of Renewable Energy · Sunyani, Ghana
              </div>
              <h1 className="mb-[26px] max-w-[620px] font-serif text-[54px] font-normal leading-[1.02] tracking-[-0.02em] text-[#fbfaf5] md:text-[68px]">
                Training the engineers who power Africa&apos;s{" "}
                <em className="italic text-gold-bright">renewable</em> future.
              </h1>
              <p className="mb-[34px] max-w-[520px] text-lg leading-[1.62] text-[#c9d9cc]">
                {motto} A TVET/NVTI accredited center delivering hands-on training across solar, wind,
                biogas, electric vehicles and energy storage — now one practical portal for applicants,
                students and staff.
              </p>
              <div className="flex flex-wrap gap-[14px]">
                <Link
                  href="/signup"
                  className="rounded-full bg-[#fbfaf5] px-7 py-[15px] text-[15px] font-semibold text-forest-deep transition-colors hover:bg-gold-bright"
                >
                  Start your application
                </Link>
                <Link
                  href="/programmes"
                  className="rounded-full border border-white/30 px-7 py-[15px] text-[15px] font-medium text-[#f3f1e8] transition-colors hover:border-white hover:bg-white/[.06] hover:text-white"
                >
                  Explore programmes
                </Link>
              </div>
            </div>
            <div className="relative flex aspect-[4/5] items-end rounded-t-[18px] border border-b-0 border-white/10 bg-[repeating-linear-gradient(135deg,#1c3d2a,#1c3d2a_11px,#22482f_11px,#22482f_22px)] p-[22px]">
              <span className="rounded-md bg-black/25 px-[10px] py-1.5 font-mono text-[11px] text-[#a9c7b2]">
                campus / solar-array photo
              </span>
              <div className="absolute left-[22px] top-[22px] rounded-lg bg-[#fbfaf5] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-forest-deep">
                TVET / NVTI accredited
              </div>
            </div>
          </div>
          {/* stats */}
          <div className="grid grid-cols-3 border-t border-white/15">
            {stats.map((s) => (
              <div key={s.label} className="border-r border-white/10 px-1 py-[26px] last:border-r-0">
                <div className="mb-2 font-serif text-[42px] leading-none text-gold-bright">{s.n}</div>
                <div className="max-w-[220px] text-[13px] leading-[1.45] text-[#b9c9bc]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== accreditation strip ===== */}
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-8 px-7 py-[26px]">
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            Accredited &amp; affiliated with
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-[14px]">
            {PARTNERS.map((p) => (
              <span
                key={p}
                className="rounded-2xl border border-line bg-paper px-4 py-2 font-mono text-[13px] tracking-[0.06em] text-muted"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ===== mission / vision / values ===== */}
      <div id="about" className="mx-auto max-w-[1200px] px-7 py-11">
        <div className="mb-2 eyebrow">01 — Mandate</div>
        <h2 className="mb-8 max-w-[640px] font-serif text-[34px] font-normal leading-[1.12] text-ink">
          Reputed for <em className="text-forest">excellence, integrity, transparency</em> and innovation.
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card p-7">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-moss">Our mission</div>
            <p className="text-base leading-[1.6] text-ink">
              Train the African youth in practical renewable technologies for efficient deployment across{" "}
              <em className="italic text-forest">residential, commercial and industrial</em> environments.
            </p>
          </div>
          <div className="rounded-2xl bg-forest p-7 text-white">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[#a9c7b2]">Our vision</div>
            <p className="text-base leading-[1.6] text-[#f3f1e8]">
              To become a leading practical renewable energy training center, reputed for{" "}
              <em className="italic text-white">excellence and innovation</em> in Africa and beyond.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.n} className="rounded-[14px] border border-line bg-paper p-5">
              <div className="mb-2 font-mono text-[12px] text-faint">{v.n}</div>
              <div className="font-serif text-[20px] text-ink">{v.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== programmes preview ===== */}
      <div id="curriculum" className="mx-auto max-w-[1200px] px-7 py-11">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 eyebrow">02 — School of Renewable Energy</div>
            <h2 className="max-w-[560px] font-serif text-[34px] font-normal leading-[1.12]">
              Flagship programs across the <em className="text-forest">energy mix.</em>
            </h2>
          </div>
          <Link href="/programmes" className="whitespace-nowrap text-sm text-forest hover:text-moss">
            View all programmes →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programmes.map((p) => (
            <Link
              key={p.id}
              href="/programmes"
              className="flex min-h-[200px] flex-col gap-[14px] rounded-2xl border border-line bg-paper p-[22px] transition-colors hover:border-forest"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#eaf0ea] px-[9px] py-1 font-mono text-[11px] tracking-[0.06em] text-moss">
                  {programmeCode(p.code, p.department.code)}
                </span>
                <span className="h-[26px] w-[26px] rounded-full" style={{ background: programmeTint(p.code) }} />
              </div>
              <div className="font-serif text-[22px] leading-[1.15] text-ink">{p.name}</div>
              <div className="flex-1 text-[13.5px] leading-[1.55] text-muted">
                {p.entryRequirements ?? `${p.department.name} · ${p.level.toLowerCase()}`}
              </div>
              <div className="flex items-center justify-between border-t border-line-soft pt-3 font-mono text-[11px] text-faint">
                <span>{p.durationSemesters * 3} months</span>
                <span className="text-forest">Details →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ===== approach ===== */}
      <div id="approach" className="mx-auto max-w-[1200px] px-7 pb-[60px] pt-11">
        <div className="mb-2 eyebrow">03 — Methodology</div>
        <h2 className="mb-[30px] max-w-[600px] font-serif text-[34px] font-normal leading-[1.12]">
          A calm, deliberate path from <em className="text-forest">enrolment to deployment.</em>
        </h2>
        <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((st) => (
            <div key={st.n} className="rounded-[14px] border border-line bg-paper p-[22px]">
              <div className="mb-[14px] font-mono text-[11px] uppercase tracking-[0.1em] text-moss">Stage {st.n}</div>
              <div className="mb-[10px] font-serif text-[20px] text-ink">{st.title}</div>
              <div className="text-[13px] leading-[1.55] text-muted">{st.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== announcements ===== */}
      {announcements.length > 0 && (
        <div className="mx-auto max-w-[1200px] px-7 pb-14 pt-2">
          <div className="grid items-start gap-8 md:grid-cols-[0.7fr_1.3fr]">
            <div>
              <div className="mb-2 eyebrow">04 — Notice board</div>
              <h2 className="mb-[14px] font-serif text-[34px] font-normal leading-[1.12]">
                Latest <em className="text-forest">announcements.</em>
              </h2>
              <p className="text-[15px] leading-[1.6] text-muted">
                Intake openings, field trips and cohort updates — posted here and in every trainee&apos;s portal.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {announcements.map((an) => (
                <div
                  key={an.id}
                  className="flex items-baseline gap-5 rounded-2xl border border-line bg-paper p-[22px] transition-colors hover:border-forest"
                >
                  <span className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#eaf0ea] px-[10px] py-[5px] font-mono text-[11px] uppercase tracking-[0.06em] text-moss">
                    {an.publishedAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                  <div>
                    <div className="mb-[5px] font-serif text-[19px] text-ink">{an.title}</div>
                    <div className="text-sm leading-[1.55] text-muted">{an.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== closing CTA ===== */}
      <div className="mx-auto max-w-[1200px] px-7 pb-16">
        <div className="relative overflow-hidden rounded-[22px] bg-forest px-11 py-[52px] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(231,181,74,.22),transparent_60%)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-7">
            <div>
              <div className="mb-[14px] font-mono text-[12px] uppercase tracking-[0.1em] text-[#a9c7b2]">
                Admissions · Year-round intake
              </div>
              <h2 className="max-w-[560px] font-serif text-[40px] font-normal leading-[1.05] text-[#fbfaf5]">
                Begin your <em className="italic text-gold-bright">application</em> today.
              </h2>
            </div>
            <div className="flex flex-wrap gap-[14px]">
              <Link
                href="/signup"
                className="rounded-full bg-[#fbfaf5] px-7 py-[15px] text-[15px] font-semibold text-forest-deep"
              >
                Apply now
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/30 px-7 py-[15px] text-[15px] font-medium text-white transition-colors hover:bg-white/[.08]"
              >
                Portal sign-in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
