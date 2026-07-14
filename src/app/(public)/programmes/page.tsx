import { db } from "@/lib/db";

// Dynamic (not ISR): avoids requiring a database connection at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Programmes" };

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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Programmes</h1>
      <p className="mt-2 text-ink-500">
        Browse programmes by school. Online applications open with the admissions
        portal (Phase 1).
      </p>

      <div className="mt-8 space-y-8">
        {schools.map((school) => (
          <section key={school.id}>
            <h2 className="text-xl font-semibold text-brand-800">{school.name}</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {school.departments.flatMap((dept) =>
                dept.programmes.map((prog) => (
                  <div
                    key={prog.id}
                    className="rounded-lg border border-ink-300/60 bg-white p-4"
                  >
                    <div className="font-medium">{prog.name}</div>
                    <div className="mt-1 text-sm text-ink-500">
                      {dept.name} · {prog.level.toLowerCase()} ·{" "}
                      {prog.durationSemesters / 2} years
                    </div>
                    {prog.entryRequirements && (
                      <p className="mt-2 text-sm text-ink-700">
                        {prog.entryRequirements}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
        {schools.length === 0 && (
          <p className="text-ink-500">No programmes published yet.</p>
        )}
      </div>
    </div>
  );
}
