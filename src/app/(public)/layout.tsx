import Link from "next/link";
import { db } from "@/lib/db";

// Dynamic (not ISR): avoids requiring a database connection at build time —
// same reasoning as the homepage/programmes pages. Without this, routes
// under this layout that don't independently force dynamic rendering
// (e.g. /login, /check-status) get statically prerendered at build time,
// which fails when the database isn't reachable from the build environment
// (as on Railway, where postgres.railway.internal is a runtime-only address).
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const institution = await db.institution.findFirst();
  const shortName = institution?.shortName ?? "SYDA·GTIC";
  const fullName = institution?.name ?? "SYDA — Green Energy & Innovation Center";
  const address = institution?.address ?? "SYDA Center, Sunyani, Bono Region, Ghana";
  const email = institution?.contactEmail ?? "info@syda-gtic.org";

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-cream/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1200px] items-center gap-7 px-7 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-forest font-mono text-[13px] font-medium text-white">
              S
            </span>
            <span className="font-mono text-[13px] uppercase tracking-[0.12em] text-ink">
              SYDA<span className="text-faint">·</span>GTIC
            </span>
          </Link>
          <div className="flex-1" />
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/programmes" className="text-muted hover:text-forest">
              Programmes
            </Link>
            <Link href="/#curriculum" className="hidden text-muted hover:text-forest sm:inline">
              Curriculum
            </Link>
            <Link href="/#about" className="hidden text-muted hover:text-forest sm:inline">
              About
            </Link>
            <Link href="/login" className="text-ink hover:text-forest">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-forest px-[18px] py-[9px] font-medium text-white transition-colors hover:bg-forest-deep"
            >
              Apply now
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="mt-5 bg-forest-deep text-[#c9d9cc]">
        <div className="mx-auto max-w-[1200px] px-7 pb-7 pt-14">
          <div className="grid gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div className="max-w-[320px]">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#fbfaf5] font-mono text-[13px] text-forest-deep">
                  S
                </span>
                <span className="font-mono text-[13px] uppercase tracking-[0.12em] text-[#fbfaf5]">
                  {shortName}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#9fb4a4]">
                A TVET/NVTI accredited renewable energy training center at the {address}.
              </p>
            </div>
            <FooterCol title="Portal">
              <FooterLink href="/programmes">Programmes</FooterLink>
              <FooterLink href="/signup">Apply now</FooterLink>
              <FooterLink href="/login">Sign in</FooterLink>
            </FooterCol>
            <FooterCol title="Institution">
              <FooterLink href="/#approach">Our approach</FooterLink>
              <FooterLink href="/#curriculum">Curriculum</FooterLink>
              <FooterLink href="/#about">About &amp; values</FooterLink>
            </FooterCol>
            <FooterCol title="Visit us">
              <span>{fullName}</span>
              <span>{address}</span>
              <span>{email}</span>
            </FooterCol>
          </div>
          <div className="mt-11 flex flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-[22px]">
            <div className="font-mono text-[11px] tracking-[0.06em] text-[#7fb894]">
              © {new Date().getFullYear()} SYDA — GREEN ENERGY &amp; INNOVATION CENTER
            </div>
            <div className="font-mono text-[11px] tracking-[0.08em] text-[#7fb894]">
              EXCELLENCE · TRANSPARENCY · INNOVATION · INTEGRITY
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-[14px] font-mono text-[11px] uppercase tracking-[0.08em] text-[#7fb894]">
        {title}
      </div>
      <div className="flex flex-col gap-[10px] text-sm text-[#c9d9cc]">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[#c9d9cc] hover:text-white">
      {children}
    </Link>
  );
}
