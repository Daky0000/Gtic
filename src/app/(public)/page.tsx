import Link from "next/link";
import { db } from "@/lib/db";
import { AnnouncementsBanner } from "@/components/announcements-banner";

// Dynamic (not ISR): avoids requiring a database connection at build time,
// and institution/announcement data should never be frozen from a build.
export const dynamic = "force-dynamic";

const FOUNDED_YEAR = 2019;

export default async function HomePage() {
  const institution = await db.institution.findFirst();
  const programmeCount = await db.programme.count();

  return (
    <div>
      <section className="bg-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            {institution?.name ?? "SYDA — Green Energy & Innovation Center"}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-brand-100">
            {institution?.motto ?? "Training the engineers who power Africa's renewable future."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-white px-5 py-2.5 font-medium text-brand-900 hover:bg-brand-50"
            >
              Apply now
            </Link>
            <Link
              href="/programmes"
              className="rounded-md border border-brand-200/50 px-5 py-2.5 font-medium text-white hover:bg-brand-800"
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
            <div className="text-3xl font-bold text-brand-800">{programmeCount}</div>
            <div className="mt-1 text-sm text-ink-500">Flagship training programmes</div>
          </div>
          <div className="rounded-lg border border-ink-300/60 bg-white p-6">
            <div className="text-3xl font-bold text-brand-800">
              {new Date().getFullYear() - FOUNDED_YEAR}
            </div>
            <div className="mt-1 text-sm text-ink-500">Years training Africa&apos;s renewable energy engineers</div>
          </div>
          <div className="rounded-lg border border-ink-300/60 bg-white p-6">
            <div className="text-3xl font-bold text-brand-800">24/7</div>
            <div className="mt-1 text-sm text-ink-500">
              AI assistant for applicants and trainees
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-ink-300/60 bg-white p-6">
            <h2 className="text-lg font-semibold text-brand-800">Our mission</h2>
            <p className="mt-2 text-sm text-ink-700">
              Train the African youth in practical renewable technologies for efficient deployment
              across residential, commercial and industrial environments.
            </p>
          </div>
          <div className="rounded-lg border border-ink-300/60 bg-white p-6">
            <h2 className="text-lg font-semibold text-brand-800">Our vision</h2>
            <p className="mt-2 text-sm text-ink-700">
              To become a leading practical renewable energy training center, reputed for
              excellence and innovation in Africa and beyond.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-ink-300/60 bg-white p-6">
          <h2 className="text-lg font-semibold text-brand-800">Our values</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Excellence", "Transparency", "Innovation", "Integrity"].map((v) => (
              <span key={v} className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800">
                {v}
              </span>
            ))}
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
