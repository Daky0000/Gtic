import { db } from "@/lib/db";
import { requirePortal } from "@/lib/rbac";
import { appBaseUrl } from "@/lib/base-url";
import { getSettingOverride, maskSecret, SETTING_KEYS } from "@/lib/settings";
import { saveIntegrations, saveInstitution } from "@/lib/actions/system";
import { Flash } from "@/components/flash";

export const metadata = { title: "System Settings" };

function StatusChip({ override, env }: { override: string | null; env: boolean }) {
  const [label, cls] = override
    ? ["Configured via console", "bg-[#e4eee6] text-forest"]
    : env
      ? ["From environment", "bg-[#deebf0] text-[#2e6f86]"]
      : ["Not configured", "bg-line-soft text-muted"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export default async function SystemSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePortal("developer");
  const { error, saved } = await searchParams;

  const [institution, paystackOverride, anthropicOverride, aiProviderOverride] = await Promise.all([
    db.institution.findFirst(),
    getSettingOverride(SETTING_KEYS.PAYSTACK_SECRET_KEY),
    getSettingOverride(SETTING_KEYS.ANTHROPIC_API_KEY),
    getSettingOverride(SETTING_KEYS.AI_PROVIDER),
  ]);
  const paystackEnv = !!process.env.PAYSTACK_SECRET_KEY;
  const anthropicEnv = !!process.env.ANTHROPIC_API_KEY;

  const field = "mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
  const label = "block text-sm font-medium text-ink-700";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">System settings</h1>
      <p className="mt-1 text-sm text-ink-500">
        Values saved here take effect immediately and override environment variables. Clearing a value
        falls back to the environment.
      </p>
      <Flash error={error} success={saved ? "Settings saved." : undefined} />

      {/* Integrations */}
      <form action={saveIntegrations} className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Integrations</h2>

        <div className="mt-4 space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <label className={label}>Paystack secret key</label>
              <StatusChip override={paystackOverride} env={paystackEnv} />
            </div>
            <input
              name="paystackKey"
              type="password"
              placeholder={paystackOverride ? `Current: ${maskSecret(paystackOverride)} — enter a new key to replace` : "sk_live_… or sk_test_…"}
              autoComplete="off"
              className={field}
            />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-500">
              <input type="checkbox" name="clearPaystack" value="1" />
              Clear the console value (fall back to environment{paystackEnv ? "" : " — none set, payments revert to demo mode"})
            </label>
            <p className="mt-1 text-xs text-ink-500">
              Webhook URL for your Paystack dashboard:{" "}
              <span className="font-mono">{appBaseUrl()}/api/payments/paystack/webhook</span>
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={label}>Anthropic API key (Claude)</label>
              <StatusChip override={anthropicOverride} env={anthropicEnv} />
            </div>
            <input
              name="anthropicKey"
              type="password"
              placeholder={anthropicOverride ? `Current: ${maskSecret(anthropicOverride)} — enter a new key to replace` : "sk-ant-…"}
              autoComplete="off"
              className={field}
            />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-500">
              <input type="checkbox" name="clearAnthropic" value="1" />
              Clear the console value (fall back to environment{anthropicEnv ? "" : " — none set, AI runs on the mock provider"})
            </label>
          </div>

          <div>
            <label className={label}>AI provider mode</label>
            <select name="aiProvider" defaultValue={aiProviderOverride ?? "auto"} className={field}>
              <option value="auto">Auto — Claude when a key is configured, otherwise mock</option>
              <option value="anthropic">Always Claude (requires a key)</option>
              <option value="mock">Always mock (no external calls, no cost)</option>
            </select>
          </div>
        </div>

        <button type="submit" className="mt-5 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
          Save integrations
        </button>
      </form>

      {/* Institution identity */}
      <form action={saveInstitution} className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-semibold text-brand-800">Institution identity</h2>
        <p className="mt-1 text-xs text-ink-500">Shown on the public site, letters and issued documents.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Name</label>
            <input name="name" required defaultValue={institution?.name ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Short name</label>
            <input name="shortName" required defaultValue={institution?.shortName ?? ""} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Motto</label>
            <input name="motto" defaultValue={institution?.motto ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Contact email</label>
            <input name="contactEmail" type="email" defaultValue={institution?.contactEmail ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Contact phone</label>
            <input name="contactPhone" defaultValue={institution?.contactPhone ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Address</label>
            <input name="address" defaultValue={institution?.address ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Website</label>
            <input name="website" defaultValue={institution?.website ?? ""} className={field} />
          </div>
        </div>
        <button type="submit" className="mt-5 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
          Save institution
        </button>
      </form>
    </div>
  );
}
