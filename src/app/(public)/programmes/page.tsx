import { db } from "@/lib/db";
import { programmeTint, programmeCode } from "@/lib/programme-style";

// Dynamic (not ISR): avoids requiring a database connection at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Programmes" };

const LEVEL_LABEL: Record<string, string> = {
  UNDERGRADUATE: "Undergraduate",
  POSTGRADUATE: "Postgraduate",
  DIPLOMA: "Diploma",
};

export default async function ProgrammesPage() {
  const schools = await db.school.findMany({
    orderBy: { name: "asc" },
    include: {
      departments: {
        orderBy: { name: "asc" },
        include: { programmes: { orderBy: { name: "asc" } } },
      },
    },
  });

  return (
    <div className="scr mx-auto max-w-[1200px] px-7 pb-[60px] pt-16">
      <div className="mb-3 eyebrow">School of Renewable Energy</div>
      <h1 className="mb-4 max-w-[640px] font-serif text-[46px] font-normal leading-[1.05]">
        Programmes across the <em className="text-forest">energy mix.</em>
      </h1>
      <p className="mb-10 max-w-[600px] text-[17px] leading-[1.6] text-muted">
        Hands-on, intensive training cohorts in renewable energy and electric mobility. Apply online
        any time — intakes run year-round.
      </p>

      <div className="space-y-12">
        {schools.map((school) => (
          <section key={school.id}>
            <div className="mb-5 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
              {school.name}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {school.departments.flatMap((dept) =>
                dept.programmes.map((prog) => (
                  <div
                    key={prog.id}
                    className="flex flex-col gap-4 rounded-[18px] border border-line bg-paper p-7 transition-colors hover:border-forest"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="rounded-md bg-[#eaf0ea] px-[9px] py-1 font-mono text-[11px] tracking-[0.06em] text-moss">
                          {programmeCode(prog.code, dept.code)}
                        </span>
                        <div className="mt-[14px] font-serif text-[26px] leading-[1.12] text-ink">
                          {prog.name}
                        </div>
                        <div className="mt-1 text-[13px] text-faint">{dept.name}</div>
                      </div>
                      <span
                        className="h-11 w-11 flex-shrink-0 rounded-xl"
                        style={{ background: programmeTint(prog.code) }}
                      />
                    </div>
                    {prog.entryRequirements && (
                      <div className="text-[14.5px] leading-[1.6] text-muted">
                        {prog.entryRequirements}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-[10px] border-t border-line-soft pt-4 text-[12px]">
                      <Meta label="Duration" value={`${prog.durationSemesters * 3} months`} />
                      <Meta label="Level" value={LEVEL_LABEL[prog.level] ?? prog.level} />
                      <Meta label="Format" value="Hands-on, on-site" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
        {schools.length === 0 && <p className="text-muted">No programmes published yet.</p>}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
        {label}
      </div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
