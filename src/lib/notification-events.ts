import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendSMS } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/whatsapp";
import type { NotificationChannel } from "@prisma/client";

/**
 * Registry of lifecycle events an admin can optionally mirror to SMS/WhatsApp
 * (in addition to the in-app bell, which always fires). Each event ships a
 * sensible default template — admins customize or disable per event+channel
 * from /admin/notifications; an event with no saved NotificationTemplate row
 * for a channel just uses this default at its default enabled state.
 *
 * Only events where a phone number is actually on hand are wired up (the
 * Student model has no phone field yet) — see dispatch call sites for what's
 * covered today: signup voucher payment, the application lifecycle (submit /
 * offer / reject / waitlist), the enrollment fee, and the short-course
 * lifecycle (approve / reject / waitlist / confirm).
 */
export const NOTIFICATION_EVENTS = {
  SIGNUP_VOUCHER_PAID: {
    label: "Signup voucher paid",
    description: "A visitor pays the application voucher fee at signup and gets their Serial/PIN.",
    vars: ["serial", "pin"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate:
      "SYDA-GTIC: payment received. Your application voucher Serial: {{serial}}, PIN: {{pin}}. Sign in at the portal with your email to complete your application.",
  },
  APPLICATION_SUBMITTED: {
    label: "Application submitted",
    description: "An applicant submits their application for the admissions office to review.",
    vars: ["refNo"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate: "SYDA-GTIC: we received your application {{refNo}}. You'll be notified as soon as it is reviewed.",
  },
  OFFER_ISSUED: {
    label: "Admission offer issued",
    description: "A registrar issues an admission offer.",
    vars: ["programmeName"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate:
      "SYDA-GTIC: congratulations! You've been offered admission to {{programmeName}}. Sign in to the portal to open your admission letter.",
  },
  APPLICATION_REJECTED: {
    label: "Application not successful",
    description: "A registrar confirms an application was not successful.",
    vars: ["refNo"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate: "SYDA-GTIC: a decision has been made on your application {{refNo}}. Unfortunately it was not successful this cycle.",
  },
  APPLICATION_WAITLISTED: {
    label: "Application waitlisted",
    description: "A registrar places an application on the waitlist.",
    vars: ["refNo"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate: "SYDA-GTIC: your application {{refNo}} has been placed on the waitlist. We'll notify you if a place opens up.",
  },
  ENROLLMENT_FEE_PAID: {
    label: "Enrollment fee paid",
    description: "An admitted applicant pays their enrollment fee and secures their place.",
    vars: ["refNo"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate: "SYDA-GTIC: your enrollment fee for {{refNo}} is paid and your place is secured. Enrollment instructions will follow.",
  },
  SHORT_COURSE_APPROVED: {
    label: "Short course application approved",
    description: "Staff approve a short-course registration, pending the course fee.",
    vars: ["courseName"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate: "SYDA-GTIC: your application for \"{{courseName}}\" has been approved. Sign in to the portal to pay the course fee.",
  },
  SHORT_COURSE_REJECTED: {
    label: "Short course application not successful",
    description: "Staff reject a short-course registration.",
    vars: ["courseName"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate: "SYDA-GTIC: your application for \"{{courseName}}\" was not successful this time.",
  },
  SHORT_COURSE_WAITLISTED: {
    label: "Short course application waitlisted",
    description: "Staff place a short-course registration on the waitlist.",
    vars: ["courseName"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate: "SYDA-GTIC: you're on the waitlist for \"{{courseName}}\". We'll let you know if a place opens up.",
  },
  SHORT_COURSE_CONFIRMED: {
    label: "Short course registration confirmed",
    description: "A short-course applicant pays the course fee and their place is confirmed.",
    vars: ["courseName", "batchInfo"],
    defaultEnabled: { SMS: true, WHATSAPP: false } as Record<NotificationChannel, boolean>,
    defaultTemplate: "SYDA-GTIC: your place on \"{{courseName}}\"{{batchInfo}} is confirmed. The Center will contact you with joining details.",
  },
} as const;

export type NotificationEventKey = keyof typeof NOTIFICATION_EVENTS;

const CHANNELS: NotificationChannel[] = ["SMS", "WHATSAPP"];

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in vars) return vars[key];
    console.warn(`[notifications] template references unknown variable {{${key}}}`);
    return "";
  });
}

/**
 * Fires the in-app notification (always), plus any admin-enabled SMS/WhatsApp
 * for this event using the admin's saved template — or this event's built-in
 * default when it hasn't been customized. Silently skips a channel with no
 * phone number on hand; never throws (a delivery failure must not roll back
 * the domain action it's attached to).
 */
export async function dispatchNotification(params: {
  event: NotificationEventKey;
  userId: string;
  phone?: string | null;
  title: string;
  body: string;
  href?: string;
  vars: Record<string, string>;
}): Promise<void> {
  // Never let a notification/delivery failure break the domain action it's
  // attached to (account creation, offer issuance, payment settlement, …).
  try {
    await notify(params.userId, params.title, params.body, params.href);
    if (!params.phone) return;

    const def = NOTIFICATION_EVENTS[params.event];
    const rows = await db.notificationTemplate.findMany({ where: { event: params.event } });
    const byChannel = new Map(rows.map((r) => [r.channel, r]));

    for (const channel of CHANNELS) {
      const row = byChannel.get(channel);
      const enabled = row ? row.enabled : def.defaultEnabled[channel];
      if (!enabled) continue;
      const template = row?.template ?? def.defaultTemplate;
      const message = render(template, params.vars);
      if (channel === "SMS") await sendSMS({ to: params.phone, message });
      else await sendWhatsApp({ to: params.phone, message });
    }
  } catch (e) {
    console.error(`[notifications] dispatch failed for event ${params.event}:`, e);
  }
}
