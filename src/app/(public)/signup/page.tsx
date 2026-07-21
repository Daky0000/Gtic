import Link from "next/link";
import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { APPLICATION_VOUCHER_FEE_PESEWAS } from "@/lib/admission-cycle";
import { admissionForm } from "@/lib/form-placement";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Start your application" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Display only — the server action re-resolves (and bootstraps) the cycle.
  const [cycle, admission] = await Promise.all([
    db.admissionCycle.findFirst({ where: { status: "OPEN" }, orderBy: { opensAt: "desc" } }),
    admissionForm(),
  ]);
  const feeLabel = formatGHS(cycle?.applicationFee ?? APPLICATION_VOUCHER_FEE_PESEWAS);

  // Admissions can be closed from the form builder (admission form not
  // published). Respect that instead of taking payment for a closed intake.
  if (admission && admission.status !== "PUBLISHED") {
    return (
      <div className="scr mx-auto max-w-[560px] px-7 py-20 text-center">
        <div className="mb-3 eyebrow">Admissions</div>
        <h1 className="mb-3 font-serif text-[34px] font-normal">Applications are closed right now.</h1>
        <p className="text-[15px] leading-[1.6] text-muted">
          {admission.description ?? "Please check back when the next intake opens."}
        </p>
        <Link href="/" className="mt-6 inline-block text-forest hover:text-moss">← Back to home</Link>
      </div>
    );
  }

  return <SignupForm feeLabel={feeLabel} intro={admission?.description ?? null} />;
}
