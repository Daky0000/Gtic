import "server-only";
import { db } from "@/lib/db";

/** Default application voucher fee: GHS 50, stored in pesewas. */
export const APPLICATION_VOUCHER_FEE_PESEWAS = 5000;
/** Placeholder acceptance fee for auto-created cycles (GHS 200). */
const DEFAULT_ACCEPTANCE_FEE_PESEWAS = 20000;

/**
 * The admission cycle new applications attach to. On a fresh database (e.g.
 * a production deploy where the demo seed never runs) there are no cycles at
 * all, which used to dead-end every signup with "applications are not open".
 * In that case bootstrap a rolling year-round cycle at the default fees.
 * If cycles exist but are all CLOSED, admissions were closed deliberately
 * from the admin console and we respect that (returns null).
 */
export async function currentOrBootstrapCycle() {
  const open = await db.admissionCycle.findFirst({
    where: { status: "OPEN" },
    orderBy: { opensAt: "desc" },
  });
  if (open) return open;

  const existingCycles = await db.admissionCycle.count();
  if (existingCycles > 0) return null;

  const now = new Date();
  const y = now.getFullYear();
  const year =
    (await db.academicYear.findFirst({ where: { isCurrent: true } })) ??
    (await db.academicYear.findFirst({ orderBy: { startsOn: "desc" } })) ??
    (await db.academicYear.upsert({
      where: { label: `${y}/${y + 1}` },
      update: {},
      create: {
        label: `${y}/${y + 1}`,
        startsOn: new Date(Date.UTC(y, 0, 1)),
        endsOn: new Date(Date.UTC(y + 1, 11, 31)),
        isCurrent: true,
      },
    }));

  return db.admissionCycle.create({
    data: {
      name: `${y} Admissions`,
      academicYearId: year.id,
      opensAt: now,
      closesAt: new Date(Date.UTC(y + 1, 11, 31)),
      applicationFee: APPLICATION_VOUCHER_FEE_PESEWAS,
      acceptanceFee: DEFAULT_ACCEPTANCE_FEE_PESEWAS,
      status: "OPEN",
    },
  });
}
