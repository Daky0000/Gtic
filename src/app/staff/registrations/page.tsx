import { db } from "@/lib/db";
import { requireRole, ROLES } from "@/lib/rbac";
import { formatGHS } from "@/lib/money";
import { PageHeader, StatusChip, type ChipTone } from "@/components/ui";

export const metadata = { title: "Applicant Registrations" };

const STATUS_TONE: Record<string, ChipTone> = {
  COMPLETED: "green",
  PENDING: "amber",
  EXPIRED: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Paid — account created",
  PENDING: "Awaiting payment",
  EXPIRED: "Expired",
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(
    ROLES.ADMISSIONS_OFFICER, ROLES.REGISTRAR, ROLES.MANAGEMENT, ROLES.SYSTEM_ADMIN
  );
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const regs = await db.pendingRegistration.findMany({
    where: query
      ? {
          OR: [
            { serial: { equals: query, mode: "insensitive" } },
            { pin: { equals: query } },
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: query ? 50 : 30,
  });

  const paidCount = await db.pendingRegistration.count({ where: { status: "COMPLETED" } });

  return (
    <div className="scr mx-auto max-w-4xl">
      <PageHeader
        title={<>Applicant <em className="text-forest">registrations.</em></>}
        lead="Every application-voucher purchase. Confirm a payment by matching the applicant's Serial and PIN — a paid row means their account exists and the fee is cleared."
      />

      <form className="mb-5 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by Serial, PIN, email, name or phone"
          className="flex-1 rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        />
        <button type="submit" className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-deep">
          Search
        </button>
      </form>
      <p className="mb-4 text-xs text-faint">{paidCount} paid registration(s) in total.</p>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-[11px] uppercase tracking-[0.06em] text-ink-500">
            <tr>
              <th className="px-3 py-2">Applicant</th>
              <th className="px-3 py-2">Serial</th>
              <th className="px-3 py-2">PIN</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Registered</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {regs.map((r) => (
              <tr key={r.id} className="border-t border-line-soft">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-ink-500">{r.email} · {r.phone}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.serial}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.pin}</td>
                <td className="px-3 py-2 font-mono">{formatGHS(r.amount)}</td>
                <td className="px-3 py-2 text-ink-500">{r.createdAt.toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">
                  <StatusChip tone={STATUS_TONE[r.status] ?? "neutral"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </StatusChip>
                </td>
              </tr>
            ))}
            {regs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-500">
                  {query ? "No registration matches that search." : "No registrations yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
