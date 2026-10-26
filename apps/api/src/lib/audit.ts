/**
 * Audit helper — every meaningful action writes one row (who, what, on which entity).
 * Sprint 5 adds the UI lens over this; the writes start NOW so the ledger is complete.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "auditLog">;

export async function writeAudit(
  db: Db | Prisma.TransactionClient,
  input: {
    userId?: string | null;
    action: string;
    entity?: string;
    meta?: Prisma.InputJsonValue;
  },
) {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity ?? null,
        meta: input.meta,
      },
    });
  } catch (err) {
    // Auditing must never break the main flow — log and continue.
    console.error("[audit] failed to write audit log", err);
  }
}
