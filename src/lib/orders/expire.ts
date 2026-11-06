import { prisma } from "../db";
import { syncOrderPayments } from "./payments";
import { sendPaidNotifications } from "./notifications";
import { resendPendingVerifications, switchGopayToTransfer } from "./transfer-verify";

/**
 * Nezaplacené objednávky přes GoPay po lhůtě (reservation.gopay_minutes, 60 min) převede na platbu převodem / QR
 * kódem – zákazník dostane platební údaje, ověřovatel ověřovací e-mail (SPECIFIKACE 5b). Před převodem se ještě
 * ověří stav platby v GoPay. Objednávky se automaticky neruší – zrušit je může jen admin.
 * Vrací počet převedených objednávek.
 */
export async function expireStaleOrders(now = new Date()): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: "PENDING", paymentMethod: "GOPAY", reservedUntil: { lt: now } },
    select: { id: true, paymentMethod: true },
    take: 200,
  });

  let switched = 0;
  for (const order of stale) {
    if (order.paymentMethod === "GOPAY") {
      await syncOrderPayments(order.id);
      const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
      if (current?.status !== "PENDING") continue;
    }
    if (await switchGopayToTransfer(order.id, now)) switched++;
  }
  return switched;
}

/**
 * Dorovná e-maily po zaplacení, které se nepodařilo odeslat (výpadek SMTP apod.):
 * potvrzení s PDF zákazníkovi a upozornění provozovateli. Odeslání je jednorázové
 * (časová razítka v objednávce), takže opakované volání nic nezdvojí.
 */
export async function retryPaidNotifications(now = new Date()): Promise<number> {
  const pending = await prisma.order.findMany({
    where: {
      status: { in: ["PAID", "SHIPPED", "COMPLETED"] },
      anonymizedAt: null,
      paidAt: { gte: new Date(now.getTime() - 7 * 24 * 3_600_000) },
      OR: [{ paymentConfirmationSentAt: null }, { ownerNotifiedAt: null }],
    },
    select: { id: true },
    take: 50,
  });
  let retried = 0;
  for (const { id } of pending) {
    try {
      await sendPaidNotifications(id);
      retried++;
    } catch (err) {
      console.error("[notify] retry failed", id, err);
    }
  }
  return retried;
}

let lastRun = 0;

/** Levné „líné“ spuštění při běžných požadavcích (nejvýše jednou za minutu). Doplňuje cron. */
export function maybeExpireStaleOrders() {
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  expireStaleOrders().catch((err) => console.error("[expire] failed", err));
  // Ověřovací e-maily plateb převodem každých 24 h – cron na Vercelu (Hobby) běží jen 1× denně
  resendPendingVerifications().catch((err) => console.error("[verify] resend failed", err));
}
