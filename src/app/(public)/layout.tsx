import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink-300/60 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-800">
            CampusCore
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
          CampusCore — AI-cored University Management System (demo deployment)
        </div>
      </footer>
    </div>
  );
}
