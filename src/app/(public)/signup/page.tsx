import { db } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { APPLICATION_VOUCHER_FEE_PESEWAS } from "@/lib/admission-cycle";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Start your application" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Display only — the server action re-resolves (and bootstraps) the cycle.
  const cycle = await db.admissionCycle.findFirst({
    where: { status: "OPEN" },
    orderBy: { opensAt: "desc" },
  });
  const feeLabel = formatGHS(cycle?.applicationFee ?? APPLICATION_VOUCHER_FEE_PESEWAS);

  return <SignupForm feeLabel={feeLabel} />;
}
