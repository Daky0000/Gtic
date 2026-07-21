"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { NOTIFICATION_EVENTS, type NotificationEventKey } from "@/lib/notification-events";
import type { NotificationChannel } from "@prisma/client";

const CHANNELS: readonly string[] = ["SMS", "WHATSAPP"];

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function parseEventAndChannel(formData: FormData, back: string): { event: NotificationEventKey; channel: NotificationChannel } {
  const event = String(formData.get("event") ?? "");
  const channel = String(formData.get("channel") ?? "");
  if (!(event in NOTIFICATION_EVENTS) || !CHANNELS.includes(channel)) {
    fail(back, "Unknown notification event or channel.");
  }
  return { event: event as NotificationEventKey, channel: channel as NotificationChannel };
}

export async function saveNotificationTemplate(formData: FormData) {
  const admin = await requireDeveloperConsole();
  const back = "/admin/notifications";
  const { event, channel } = parseEventAndChannel(formData, back);

  const template = String(formData.get("template") ?? "").trim();
  if (!template) fail(back, "Enter a message template.");
  const enabled = formData.get("enabled") === "on";

  await db.notificationTemplate.upsert({
    where: { event_channel: { event, channel } },
    update: { enabled, template, updatedById: admin.id },
    create: { event, channel, enabled, template, updatedById: admin.id },
  });
  await audit({
    actorId: admin.id, action: "notifications.template_saved", entityType: "NotificationTemplate",
    entityId: `${event}:${channel}`, after: { enabled },
  });
  redirect(`${back}?saved=1`);
}

/** Deletes the customized row so the event falls back to its built-in
 * default template and default enabled state. */
export async function resetNotificationTemplate(formData: FormData) {
  const admin = await requireDeveloperConsole();
  const back = "/admin/notifications";
  const { event, channel } = parseEventAndChannel(formData, back);

  await db.notificationTemplate.deleteMany({ where: { event, channel } });
  await audit({
    actorId: admin.id, action: "notifications.template_reset", entityType: "NotificationTemplate",
    entityId: `${event}:${channel}`,
  });
  redirect(`${back}?saved=1`);
}
