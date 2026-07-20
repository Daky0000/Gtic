import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/rbac";
import { formatGHS } from "@/lib/money";
import { startShortCourseRegistration } from "@/lib/actions/short-courses";
import { reconcilePendingPaystackPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";

export const metadata = { title: "Short Courses" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Continue application",
  SUBMITTED: "View submission",
  WAITLISTED: "View waitlist status",
  PENDING_PAYMENT: "Complete payment",
  CONFIRMED: "✓ Registered",
  REJECTED: "View decision",
  CANCELLED: "Register",
};

export default async function ShortCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  const { error, paid } = await searchParams;
  const user = await getCurrentUser();
  // Settle any checkout the payer completed but never returned from.
  if (user) await reconcilePendingPaystackPayments(user.id);

  const courses = await db.shortCourse.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { batches: { where: { active: true }, orderBy: { startDate: "asc" } } },
  });
  const myRegs = user
    ? await db.shortCourseRegistration.findMany({
        where: { userId: user.id },
        include: { shortCourse: true },
      })
    : [];
  const regByCourse = new Map(myRegs.map((r) => [r.shortCourseId, r]));
  const now = new Date();

  return (
    <div className="scr mx-auto max-w-[1000px] px-7 pb-[60px] pt-16">
      <div className="mb-3 eyebrow">Vocational training</div>
      <h1 className="mb-4 max-w-[640px] font-serif text-[46px] font-normal leading-[1.05]">
        Weeks of practical training. One <em className="text-forest">specialized skill.</em>
      </h1>
      <p className="mb-8 max-w-[620px] text-[17px] leading-[1.6] text-muted">
        Focused, hands-on intensives for professionals, entrepreneurs and farmers — leave confidently
        capable of delivering a complete solution. Register online; payment confirms your place in a
        scheduled batch.
      </p>

      {error && (
        <p role="alert" className="mb-6 rounded-[11px] bg-[#faece9] p-3 text-sm text-[#b23a2e]">{error}</p>
      )}
      {paid && (
        <p className="mb-6 rounded-[11px] bg-[#eaf0ea] p-3 text-sm text-forest">
          Payment received — your registration is confirmed. The Center will contact you with joining details.
        </p>
      )}

      {!user && (
        <p className="mb-8 rounded-[14px] border border-gold/30 bg-[#f6efdf] p-4 text-sm text-[#7a5a22]">
          To register, first{" "}
          <Link href="/login" className="font-medium underline">sign in</Link> — or{" "}
          <Link href="/signup" className="font-medium underline">create an account</Link> if you are new
          here (the application voucher on that page is for the diploma programmes; once your account
          exists you can register for short courses from this page).
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {courses.map((c) => {
          const reg = regByCourse.get(c.id);
          const priced = c.feePesewas > 0;
          const openBatches = c.batches.filter((b) => b.startDate > now);
          return (
            <div key={c.id} className="flex flex-col gap-4 rounded-[18px] border border-line bg-paper p-7">
              <div>
                <span className="rounded-md bg-[#eaf0ea] px-[9px] py-1 font-mono text-[11px] tracking-[0.06em] text-moss">
                  {c.code}
                </span>
                <h2 className="mt-[14px] font-serif text-[24px] leading-[1.15] text-ink">{c.name}</h2>
              </div>
              <p className="text-[14.5px] leading-[1.6] text-muted">{c.description}</p>
              <p className="text-[13px] text-faint">Designed for: {c.audience}</p>
              <div className="grid grid-cols-2 gap-[10px] border-t border-line-soft pt-4 text-[12px]">
                <div>
                  <div className="mb-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Duration</div>
                  <div className="text-ink">{c.durationWeeks} weeks</div>
                </div>
                <div>
                  <div className="mb-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Next batch</div>
                  <div className="text-ink">
                    {openBatches[0]
                      ? `${openBatches[0].label} — ${openBatches[0].startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                      : "To be scheduled"}
                  </div>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                <div className="text-[15px] font-semibold text-ink">
                  {priced ? formatGHS(c.feePesewas) : <span className="text-faint">Fee to be announced</span>}
                </div>
                {reg?.status === "CONFIRMED" ? (
                  <Link
                    href={`/short-courses/register/${reg.id}`}
                    className="rounded-full bg-[#eaf0ea] px-4 py-2 text-sm font-medium text-forest"
                  >
                    ✓ Registered
                  </Link>
                ) : user && priced ? (
                  <form action={startShortCourseRegistration}>
                    <input type="hidden" name="shortCourseId" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-deep"
                    >
                      {reg ? STATUS_LABEL[reg.status] ?? "Continue" : "Register"}
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-faint">
                    {priced ? "Sign in to register" : "Registration opens once the fee is published"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {courses.length === 0 && <p className="text-muted">No short courses published yet.</p>}
      </div>
    </div>
  );
}
