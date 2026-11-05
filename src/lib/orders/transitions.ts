import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { audit, type ActionContext } from "../audit";
import { OutOfStockError, TransitionError } from "../errors";
import { releaseStock, reserveStock } from "./stock";
import { sendPaidNotifications, sendShippedNotification } from "./notifications";

export { TransitionError };

/** Povolené ruční přechody v administraci */
export const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "COMPLETED", "CANCELLED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  // Zrušenou (např. po vypršení rezervace) lze označit jako zaplacenou, když platba převodem dorazí pozdě.
  CANCELLED: ["PAID"],
};

/** Zamkne řádek objednávky do konce transakce, aby se souběžné změny nepřebíjely. */
async function lockOrder(tx: Prisma.TransactionClient, orderId: number) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new TransitionError("Objednávka neexistuje.");
  return order;
}

function stockItems(order: { items: { productId: number; quantity: number; name: string }[] }) {
  return order.items.map((i) => ({ productId: i.productId, quantity: i.quantity, name: i.name }));
}

export type MarkPaidResult = { changed: boolean; oversold: boolean };

/**
 * Označí objednávku jako zaplacenou. Idempotentní: opakované volání (např. opakovaná notifikace GoPay)
 * nic nezmění a e-maily se neodešlou znovu.
 *
 * - Sklad: box je zarezervovaný od vytvoření objednávky. Pokud rezervace mezitím vypršela,
 *   zkusí se box odečíst znovu. U ruční změny v administraci se při nedostatku boxů platba neoznačí.
 *   U platby z GoPay (peníze už jsou přijaty) se objednávka označí jako zaplacená i tak
 *   a provozovatel dostane upozornění na přeprodej.
 */
export async function markPaid(orderId: number, ctx: ActionContext): Promise<MarkPaidResult> {
  const run = (allowOversell: boolean) =>
    prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (order.status === "PAID" || order.status === "SHIPPED" || order.status === "COMPLETED") {
        return { changed: false, oversold: false };
      }
      if (order.status === "CANCELLED" && ctx.source !== "admin" && ctx.source !== "gopay") {
        throw new TransitionError("Zrušenou objednávku nelze označit jako zaplacenou.");
      }

      let stockReserved = order.stockReserved;
      let oversold = false;
      if (!stockReserved) {
        if (allowOversell) {
          oversold = true;
        } else {
          stockReserved = await reserveStock(tx, stockItems(order));
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: new Date(), stockReserved, reservedUntil: null, cancelledAt: null },
      });
      await audit(
        {
          action: "status_change",
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "PAID",
          detail: oversold ? "Zaplaceno, ale box už nebyl skladem (přeprodej)" : null,
        },
        ctx,
        tx,
      );
      return { changed: true, oversold };
    });

  let result: MarkPaidResult;
  try {
    result = await run(false);
  } catch (err) {
    if (err instanceof OutOfStockError) {
      if (ctx.source !== "gopay") {
        throw new TransitionError(`${err.productName}: není skladem, objednávku nelze označit jako zaplacenou.`);
      }
      result = await run(true);
    } else {
      throw err;
    }
  }

  if (result.changed) {
    await sendPaidNotifications(orderId, { oversold: result.oversold }).catch((err) =>
      console.error("[mail] paid notifications failed", err),
    );
  }
  return result;
}

/**
 * Odeslání (doručení dopravcem) nebo připravení k osobnímu převzetí.
 * Zákazníkovi odejde e-mail s dopravcem a číslem zásilky, resp. s informací o převzetí.
 */
export async function markShipped(
  orderId: number,
  shipment: { carrier?: string | null; trackingNumber?: string | null },
  ctx: ActionContext,
) {
  let carrier = shipment.carrier?.trim() || null;
  const trackingNumber = shipment.trackingNumber?.trim() || null;

  const changed = await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "SHIPPED") return false;
    if (order.status !== "PAID") throw new TransitionError("Odeslat lze jen zaplacenou objednávku.");
    if (order.deliveryMethod === "SHIPPING" && !carrier) throw new TransitionError("Vyplňte dopravce.");
    if (order.deliveryMethod === "PACKETA") carrier ??= "Zásilkovna";

    await tx.order.update({
      where: { id: order.id },
      data: { status: "SHIPPED", shippedAt: new Date(), carrier, trackingNumber },
    });
    await audit({ action: "status_change", orderId: order.id, fromStatus: order.status, toStatus: "SHIPPED" }, ctx, tx);
    return true;
  });

  if (changed) {
    await sendShippedNotification(orderId).catch((err) => console.error("[mail] shipped notification failed", err));
  }
}

export async function markCompleted(orderId: number, ctx: ActionContext) {
  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "COMPLETED") return;
    if (order.status !== "SHIPPED" && order.status !== "PAID") {
      throw new TransitionError("Dokončit lze jen zaplacenou nebo odeslanou objednávku.");
    }
    await tx.order.update({ where: { id: order.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await audit({ action: "status_change", orderId: order.id, fromStatus: order.status, toStatus: "COMPLETED" }, ctx, tx);
  });
}

/**
 * Zrušení objednávky. Rezervované boxy se vrátí na sklad.
 * Vrácení peněz u zaplacené objednávky se řeší ručně (GoPay / převodem).
 */
export async function cancelOrder(orderId: number, ctx: ActionContext, reason?: string) {
  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "CANCELLED") return;
    if (order.status !== "PENDING" && order.status !== "PAID") {
      throw new TransitionError("Zrušit lze jen nezaplacenou nebo zaplacenou (neodeslanou) objednávku.");
    }
    if (order.stockReserved) await releaseStock(tx, stockItems(order));
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), stockReserved: false, reservedUntil: null },
    });
    await audit(
      { action: "status_change", orderId: order.id, fromStatus: order.status, toStatus: "CANCELLED", detail: reason ?? null },
      ctx,
      tx,
    );
  });
}

export async function changeStatus(
  orderId: number,
  to: OrderStatus,
  ctx: ActionContext,
  shipment?: { carrier?: string | null; trackingNumber?: string | null },
) {
  switch (to) {
    case "PAID":
      return markPaid(orderId, ctx);
    case "SHIPPED":
      return markShipped(orderId, shipment ?? {}, ctx);
    case "COMPLETED":
      return markCompleted(orderId, ctx);
    case "CANCELLED":
      return cancelOrder(orderId, ctx, "Zrušeno v administraci");
    default:
      throw new TransitionError("Tento přechod není povolen.");
  }
}
