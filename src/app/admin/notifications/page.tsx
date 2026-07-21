import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { NOTIFICATION_EVENTS, type NotificationEventKey } from "@/lib/notification-events";
import { saveNotificationTemplate, resetNotificationTemplate } from "@/lib/actions/notification-templates";
import { Flash } from "@/components/flash";
import type { NotificationChannel } from "@prisma/client";

export const metadata = { title: "Notifications" };

const field = "w-full rounded-md border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none";
const saveBtn = "rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-deep";

const CHANNEL_LABEL: Record<NotificationChannel, string> = { SMS: "SMS", WHATSAPP: "WhatsApp" };

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireDeveloperConsole();
  const { error, saved } = await searchParams;

  const rows = await db.notificationTemplate.findMany();
  const byKey = new Map(rows.map((r) => [`${r.event}:${r.channel}`, r]));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="mt-1 text-sm text-ink-500">
        Every event below always posts an in-app notification. Turn on SMS and/or WhatsApp here to also text
        the person — each has a default message you can customize, using <code>{"{{variable}}"}</code>{" "}
        placeholders shown under each field.
      </p>
      <Flash error={error} success={saved ? "Notification settings updated." : undefined} />

      {(Object.keys(NOTIFICATION_EVENTS) as NotificationEventKey[]).map((key) => {
        const def = NOTIFICATION_EVENTS[key];
        return (
          <section key={key} className="mt-6 rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold text-brand-800">{def.label}</h2>
            <p className="mt-1 text-xs text-ink-500">{def.description}</p>
            <p className="mt-1 text-[11px] text-ink-400">
              Available: {def.vars.map((v) => `{{${v}}}`).join(", ")}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["SMS", "WHATSAPP"] as NotificationChannel[]).map((channel) => {
                const row = byKey.get(`${key}:${channel}`);
                const enabled = row ? row.enabled : def.defaultEnabled[channel];
                const template = row?.template ?? def.defaultTemplate;
                return (
                  <form key={channel} action={saveNotificationTemplate} className="rounded-[11px] border border-ink-100 p-3">
                    <input type="hidden" name="event" value={key} />
                    <input type="hidden" name="channel" value={channel} />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink-700">{CHANNEL_LABEL[channel]}</span>
                      <label className="flex items-center gap-1.5 text-xs text-ink-600">
                        <input type="checkbox" name="enabled" defaultChecked={enabled} />
                        Enabled
                      </label>
                    </div>
                    <textarea
                      name="template"
                      defaultValue={template}
                      rows={3}
                      className={`${field} mt-2`}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button type="submit" className={saveBtn}>Save</button>
                      {row && (
                        <button
                          type="submit"
                          formAction={resetNotificationTemplate}
                          className="rounded-full border border-ink-300 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50"
                        >
                          Reset to default
                        </button>
                      )}
                    </div>
                  </form>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
