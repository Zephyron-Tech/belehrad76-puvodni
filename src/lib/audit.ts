import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";

/** verifier = odkaz z ověřovacího e-mailu platby převodem (bez přihlášení) */
export type ActionSource = "system" | "gopay" | "admin" | "customer" | "verifier";

export type ActionContext = {
  source: ActionSource;
  /** Volitelné jméno / iniciály (účet administrace je společný) */
  actor?: string | null;
  ip?: string | null;
};

type Db = PrismaClient | Prisma.TransactionClient;

/** Záznam do audit logu. Nikdy sem nezapisujte osobní údaje zákazníků. */
export async function audit(
  entry: {
    action: string;
    orderId?: number | null;
    fromStatus?: OrderStatus | null;
    toStatus?: OrderStatus | null;
    detail?: string | null;
  },
  ctx: ActionContext,
  db: Db = prisma,
) {
  await db.auditLog.create({
    data: {
      action: entry.action,
      orderId: entry.orderId ?? null,
      fromStatus: entry.fromStatus ?? null,
      toStatus: entry.toStatus ?? null,
      detail: entry.detail ?? null,
      source: ctx.source,
      actor: ctx.actor?.trim().slice(0, 40) || null,
      ip: ctx.ip ?? null,
    },
  });
}
