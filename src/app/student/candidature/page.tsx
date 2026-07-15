import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/rbac";
import { db } from "@/lib/db";
import { submitMilestone } from "@/lib/actions/graduate";
import { Flash } from "@/components/flash";

export const metadata = { title: "My Candidature" };

export default async function CandidaturePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requirePortal("student");
  const student = await db.student.findUnique({ where: { userId: user.id } });
  if (!student) redirect("/student");

  const candidature = await db.candidature.findUnique({
    where: { studentId: student.id },
    include: { milestones: { orderBy: { ord: "asc" } } },
  });

  if (!candidature) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold">My candidature</h1>
        <Flash error={error} />
        <p className="mt-3 text-sm text-ink-500">
          No research candidature has been set up for you yet. This applies to postgraduate research
          students — contact the Graduate School office if you believe this is missing.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">My candidature</h1>
      {candidature.topic && <p className="mt-1 text-sm text-ink-500">{candidature.topic}</p>}

      <div className="mt-6 space-y-3">
        {candidature.milestones.map((m) => (
          <div key={m.id} className="rounded-lg border border-ink-300/60 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{m.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                m.status === "APPROVED" ? "bg-brand-100 text-brand-800" :
                m.status === "SUBMITTED" ? "bg-amber-100 text-amber-800" :
                m.status === "RETURNED" ? "bg-red-100 text-red-800" : "bg-ink-100 text-ink-600"
              }`}>
                {m.status}
              </span>
            </div>
            {m.feedback && <p className="mt-1 text-xs text-ink-600">{m.feedback}</p>}
            {(m.status === "PENDING" || m.status === "RETURNED") && (
              <form action={submitMilestone} className="mt-2">
                <input type="hidden" name="milestoneId" value={m.id} />
                <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                  Submit for review
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
