import Link from "next/link";
import { db } from "@/lib/db";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const institution = await db.institution.findFirst();
  const shortName = institution?.shortName ?? "SYDA-GTIC";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink-300/60 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-800">
            {shortName}
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/programmes" className="text-ink-700 hover:text-brand-800">
              Programmes
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-brand-800 px-4 py-2 font-medium text-white hover:bg-brand-700"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink-300/60 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-500">
          {institution?.name ?? "SYDA — Green Energy & Innovation Center"} · {institution?.address ?? "Sunyani, Bono Region, Ghana"}
          {institution?.contactEmail && <> · {institution.contactEmail}</>}
        </div>
      </footer>
    </div>
  );
}
