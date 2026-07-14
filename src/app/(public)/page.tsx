import Link from "next/link";
import { db } from "@/lib/db";
import { AnnouncementsBanner } from "@/components/announcements-banner";

// Refresh the public landing data every 5 minutes rather than freezing at build.
export const revalidate = 300;

export default async function HomePage() {
  const institution = await db.institution.findFirst();
  const counts = {
    schools: await db.school.count(),
    programmes: await db.programme.count(),
  };

  return (
    <div>
      <section className="bg-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            {institution?.name ?? "CampusCore Demo University"}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-brand-100">
            {institution?.motto ??
              "Powering the future through knowledge and innovation."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/programmes"
              className="rounded-md bg-white px-5 py-2.5 font-medium text-brand-900 hover:bg-brand-50"
            >
              Explore programmes
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-brand-200/50 px-5 py-2.5 font-medium text-white hover:bg-brand-800"
            >
              Portal sign-in
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-ink-300/60 bg-white p-6">
            <div className="text-3xl font-bold text-brand-800">{counts.schools}</div>
            <div className="mt-1 text-sm text-ink-500">Schools</div>
          </div>
          <div className="rounded-lg border border-ink-300/60 bg-white p-6">
            <div className="text-3xl font-bold text-brand-800">{counts.programmes}</div>
            <div className="mt-1 text-sm text-ink-500">Programmes</div>
          </div>
          <div className="rounded-lg border border-ink-300/60 bg-white p-6">
            <div className="text-3xl font-bold text-brand-800">24/7</div>
            <div className="mt-1 text-sm text-ink-500">
              AI assistant for applicants and students
            </div>
          </div>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-ink-700">Announcements</h2>
        <div className="mt-3">
          <AnnouncementsBanner audience="ALL" />
        </div>
      </section>
    </div>
  );
}
