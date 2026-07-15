import "server-only";
import { db } from "@/lib/db";

/**
 * In-app notification helper. Email/SMS delivery is a later adapter swap —
 * every event that matters to a user should land here so the bell in the
 * portal header always tells the truth.
 */
export async function notify(
  userId: string,
  title: string,
  body: string,
  href?: string
) {
  await db.notification.create({ data: { userId, title, body, href } });
}

export async function notifyMany(
  userIds: string[],
  title: string,
  body: string,
  href?: string
) {
  if (userIds.length === 0) return;
  await db.notification.createMany({
    data: userIds.map((userId) => ({ userId, title, body, href })),
  });
}
