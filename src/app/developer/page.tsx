import Link from "next/link";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/rbac";
import { formatGHS, parseUsdRate } from "@/lib/money";
import { getSetting, maskSecret, SETTING_KEYS } from "@/lib/settings";
import { appBaseUrl } from "@/lib/base-url";
import { PageHeader, Card, CardLabel, StatusChip } from "@/components/ui";

export const metadata = { title: "Developer Console" };

export default async function DeveloperOverview() {
  await requirePortal("developer");

  const [
    userCount, applicationCount, submittedCount, studentCount,
    pendingPayments, outstandingInvoices, shortCourseRegs, formCount,
    paystackKey, aiProvider, rateRaw, recentAudit,
  ] = await Promise.all([
    db.user.count(),
    db.application.count(),
    db.application.count({ where: { status: { not: "DRAFT" } } }),
    db.student.count(),
    db.payment.count({ where: { status: "PENDING", channel: "PAYSTACK" } }),
    db.invoice.aggregate({ where: { status: { not: "PAID" } }, _sum: { total: true, paid: true } }),
    db.shortCourseRegistration.count({ where: { status: "CONFIRMED" } }),
    db.formDef.count(),
    getSetting(SETTING_KEYS.PAYSTACK_SECRET_KEY),
    getSetting(SETTING_KEYS.AI_PROVIDER),
    getSetting(SETTING_KEYS.USD_TO_GHS_RATE),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const rate = parseUsdRate(rateRaw);
  const outstanding = (outstandingInvoices._sum.total ?? 0) - (outstandingInvoices._sum.paid ?? 0);
  const mailerConfigured = !!process.env.RESEND_API_KEY;

  return (
    <div className="scr">
      <PageHeader
        title={<>Developer <em className="text-forest">console.</em></>}
        lead="System health, integrations and pricing — the plumbing behind every portal, in one place."
      />

      {/* Integration status */}
      <Card className="mb-6">
        <CardLabel>Integrations</CardLabel>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusRow
            label="Paystack"
            ok={!!paystackKey}
            detail={paystackKey ? `key ${maskSecret(paystackKey)}` : "not configured — payments settle on MOCK"}
          />
          <StatusRow
            label="AI provider"
            ok={true}
            detail={aiProvider || "auto (mock without a key)"}
          />
          <StatusRow
            label="USD multiplier"
            ok={!!rate}
            detail={rate ? `$1 = GHS ${rate.toFixed(2)}` : "not set — GHS-only pricing"}
          />
          <StatusRow
            label="Email (Resend)"
            ok={mailerConfigured}
            detail={mailerConfigured ? "configured" : "reset links print to server logs"}
          />
        </div>
        <p className="mt-4 border-t border-line-soft pt-3 text-xs text-faint">
          Paystack webhook URL: <span className="font-mono">{appBaseUrl()}/api/payments/paystack/webhook</span>
          {" · "}manage keys in{" "}
          <Link href="/developer/settings" className="text-forest hover:text-moss">System settings</Link>
        </p>
      </Card>

      {/* System stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Accounts" value={String(userCount)} sub={`${studentCount} enrolled trainees`} />
        <Stat label="Applications" value={String(applicationCount)} sub={`${submittedCount} past draft`} />
        <Stat
          label="Outstanding fees"
          value={formatGHS(outstanding)}
          sub={`${pendingPayments} Paystack checkout(s) in flight`}
        />
        <Stat
          label="Short courses / forms"
          value={`${shortCourseRegs} / ${formCount}`}
          sub="confirmed registrations / forms built"
        />
      </div>

      {/* Recent audit activity */}
      <Card className="!p-0">
        <div className="flex items-center justify-between p-5 pb-3">
          <CardLabel>Recent system activity</CardLabel>
          <Link href="/admin/audit" className="text-sm text-forest hover:text-moss">
            Full audit log →
          </Link>
        </div>
        <div className="px-5 pb-5">
          {recentAudit.length === 0 ? (
            <p className="text-sm text-faint">No audit entries yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0">
                  <span className="truncate">
                    <span className="font-mono text-xs text-faint">{a.action}</span>{" "}
                    <span className="text-muted">{a.entityType}</span>
                  </span>
                  <span className="whitespace-nowrap text-xs text-faint">
                    {a.createdAt.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <StatusChip tone={ok ? "green" : "amber"}>{ok ? "ready" : "attention"}</StatusChip>
      </div>
      <div className="mt-1 text-xs text-muted">{detail}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{label}</div>
      <div className="mt-2 font-serif text-[26px] text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}
