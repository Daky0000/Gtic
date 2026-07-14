import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string; // "module.event", e.g. "rbac.role_assigned"
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

/**
 * Append-only audit writer (XC-04). Never throws: an audit failure is logged
 * loudly but must not roll back the business action that succeeded.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before,
        after: entry.after,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] FAILED to write audit entry", entry.action, err);
  }
}
