/**
 * Platba převodem s ověřováním e-mailem (SPECIFIKACE 5b).
 *
 * Banka není napojená: po objednávce převodem odejde ověřovateli (payment.verify_email) e-mail se všemi údaji
 * pro kontrolu v internetovém bankovnictví a s odkazy Zaplaceno / Nezaplaceno – vyřeším sám / Nezaplaceno – poslat
 * upomínku. Odkazy fungují bez přihlášení, samotné otevření odkazu ale nic nemění – rozhoduje až tlačítko
 * na stránce /overeni-platby.
 *
 * Odkazy jsou jednorázové: každý ověřovací e-mail dostane nový token (starší e-maily tím přestanou platit)
 * a první rozhodnutí token spotřebuje – ostatní odkazy v e-mailu pak už nic neudělají.
 * Dokud ověřovatel nerozhodne, e-mail se opakuje každých 24 h. Objednávky převodem se automaticky neruší;
 * zrušení (uvolnění boxu) jen přihlášený admin.
 */
import crypto from "node:crypto";
import { prisma } from "../db";
import { env } from "../env";
import { getSettings } from "../settings";
import { audit, type ActionContext } from "../audit";
import { AppError } from "../errors";
import { sendMail } from "../mail/transport";
import { paymentReminderMail, transferSwitchMail, verifyPaymentMail } from "../mail/templates";
import { qrPng, transferInstructions } from "../bank";
import { markPaid } from "./transitions";
import { customerReplyTo } from "./notifications";

/** Po jaké době bez rozhodnutí se ověřovací e-mail pošle znovu */
export const VERIFY_REPEAT_MS = 24 * 3_600_000;

export type VerifyAction = "paid" | "manual" | "remind";

export class VerifyError extends AppError {}

function orderUrl(publicToken: string) {
  return `${env.appUrl}/objednavka/${publicToken}`;
}

export function verifyPageUrl(verifyToken: string, action?: VerifyAction) {
  const akce = { paid: "zaplaceno", manual: "vyresim", remind: "upominka" } as const;
  return `${env.appUrl}/overeni-platby/${verifyToken}${action ? `?akce=${akce[action]}` : ""}`;
}

async function loadOrder(where: { id: number } | { verifyToken: string } | { publicToken: string }) {
  return prisma.order.findUnique({ where: where as never, include: { items: true } });
}

/** Objednávka převodem, která ještě čeká na ověření (nezaplacená, nezrušená). */
function isOpenTransfer(order: { status: string; paymentMethod: string; anonymizedAt: Date | null }) {
  return order.status === "PENDING" && order.paymentMethod === "BANK_TRANSFER" && !order.anonymizedAt;
}

/**
 * Ověřovací e-mail ověřovateli. `repeat` = opakované upozornění (nikdo zatím nerozhodl).
 * Vydá nový jednorázový token (odkazy ve starších e-mailech přestanou platit) a uloží čas odeslání –
 * další e-mail nejdřív za 24 h.
 */
export async function sendVerifyMail(orderId: number, opts: { repeat?: boolean; claimed?: boolean; now?: Date } = {}) {
  const order = await loadOrder({ id: orderId });
  if (!order || !isOpenTransfer(order) || order.verifyState !== "WAITING") return false;
  const settings = await getSettings();
  const to = settings.str("payment.verify_email").trim();
  if (!to) {
    console.warn(`[verify] payment.verify_email není nastavený – ověřovací e-mail k objednávce ${order.number} neodešel`);
    return false;
  }
  const token = crypto.randomBytes(24).toString("base64url");
  await prisma.order.update({ where: { id: order.id }, data: { verifyToken: token } });

  const transfer = transferInstructions(settings.str("bank.account"), order.totalCzk, order.number, settings.str("seller.name"));
  const mail = verifyPaymentMail(order, settings, {
    transfer,
    repeat: !!opts.repeat,
    claimed: !!opts.claimed,
    links: {
      paid: verifyPageUrl(token, "paid"),
      manual: verifyPageUrl(token, "manual"),
      remind: verifyPageUrl(token, "remind"),
    },
    adminUrl: `${env.appUrl}/admin/objednavky/${order.id}`,
  });
  await sendMail({ to, cc: settings.str("payment.verify_cc").trim() || undefined, ...mail, replyTo: order.email });
  await prisma.order.update({ where: { id: order.id }, data: { verifyMailSentAt: opts.now ?? new Date() } });
  return true;
}

/**
 * Znovu pošle ověřovací e-mail u objednávek, kde ověřovatel 24 h nerozhodl (a dorovná e-maily, které při
 * vytvoření objednávky neodešly). Volá cron i „líné“ spuštění při běžných požadavcích.
 */
export async function resendPendingVerifications(now = new Date()): Promise<number> {
  const due = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentMethod: "BANK_TRANSFER",
      verifyState: "WAITING",
      anonymizedAt: null,
      OR: [{ verifyMailSentAt: null }, { verifyMailSentAt: { lte: new Date(now.getTime() - VERIFY_REPEAT_MS) } }],
    },
    select: { id: true, verifyMailSentAt: true },
    take: 50,
  });

  let sent = 0;
  for (const o of due) {
    // Zabrat odeslání (souběžné spuštění cronu a líného spuštění nesmí poslat dva e-maily)
    const claimed = await prisma.order.updateMany({
      where: { id: o.id, verifyMailSentAt: o.verifyMailSentAt },
      data: { verifyMailSentAt: now },
    });
    if (claimed.count !== 1) continue;
    try {
      if (await sendVerifyMail(o.id, { repeat: o.verifyMailSentAt !== null, now })) sent++;
    } catch (err) {
      await prisma.order.update({ where: { id: o.id }, data: { verifyMailSentAt: o.verifyMailSentAt } });
      console.error("[verify] resend failed", o.id, err);
    }
  }
  return sent;
}

/** Upomínka zákazníkovi: platba nedorazila, platební údaje + QR. Bez splatnosti. */
async function sendPaymentReminder(orderId: number) {
  const order = await loadOrder({ id: orderId });
  if (!order) throw new VerifyError("Objednávka neexistuje.");
  const settings = await getSettings();
  const transfer = transferInstructions(settings.str("bank.account"), order.totalCzk, order.number, settings.str("seller.name"));
  const mail = paymentReminderMail(order, settings, { orderUrl: orderUrl(order.publicToken), transfer, qrCid: "qr-platba" });
  await sendMail({
    to: order.email,
    ...mail,
    attachments: [{ filename: "qr-platba.png", content: await qrPng(transfer.spd), cid: "qr-platba" }],
    replyTo: customerReplyTo(settings),
  });
}

export type VerifyResult =
  | { done: true; action: VerifyAction }
  | { done: false; reason: "already-paid" | "cancelled" | "not-found" | "used" };

/**
 * Rozhodnutí ověřovatele (jednorázový odkaz z e-mailu) nebo admina (detail objednávky, podle id).
 *  - paid:   objednávka zaplacená, standardní e-maily (potvrzení s PDF, upozornění provozovateli)
 *  - manual: „Nezaplaceno – vyřeším sám“ – opakování e-mailů končí, objednávka dál čeká, řeší admin
 *  - remind: „Nezaplaceno – poslat upomínku“ – upomínka zákazníkovi, ověřování běží dál (další e-mail za 24 h)
 * Odkaz z e-mailu se spotřebuje hned na začátku (atomicky) – druhý klik ani jiný odkaz z téhož e-mailu nic neudělá.
 */
export async function resolveVerification(
  key: { verifyToken: string } | { orderId: number },
  action: VerifyAction,
  ctx: ActionContext,
): Promise<VerifyResult> {
  let orderId: number;
  if ("verifyToken" in key) {
    const found = await prisma.order.findUnique({ where: { verifyToken: key.verifyToken }, select: { id: true } });
    if (!found) return { done: false, reason: "used" };
    // Spotřebovat token – vyhraje jen jeden požadavek (dvojklik, dva odkazy najednou)
    const consumed = await prisma.order.updateMany({
      where: { id: found.id, verifyToken: key.verifyToken },
      data: { verifyToken: null },
    });
    if (consumed.count !== 1) return { done: false, reason: "used" };
    orderId = found.id;
  } else {
    orderId = key.orderId;
  }

  const order = await loadOrder({ id: orderId });
  if (!order || order.paymentMethod !== "BANK_TRANSFER") return { done: false, reason: "not-found" };
  if (order.status === "PAID" || order.status === "SHIPPED" || order.status === "COMPLETED") return { done: false, reason: "already-paid" };
  if (order.status === "CANCELLED") return { done: false, reason: "cancelled" };

  // Rozhodnutí z administrace zneplatní i odkazy v posledním e-mailu
  if (order.verifyToken) await prisma.order.update({ where: { id: order.id }, data: { verifyToken: null } });

  if (action === "paid") {
    await markPaid(order.id, ctx);
    return { done: true, action };
  }

  if (action === "manual") {
    await prisma.order.update({
      where: { id: order.id },
      data: { verifyState: "MANUAL", stateChangedAt: new Date() },
    });
    await audit({ action: "verify_manual", orderId: order.id }, ctx);
    return { done: true, action };
  }

  // remind: zabrat (souběžný požadavek z administrace nesmí poslat dvě upomínky), odeslat, při chybě vrátit
  const before = order.reminderSentAt;
  const now = new Date();
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, reminderSentAt: before, status: "PENDING" },
    data: {
      reminderSentAt: now,
      reminderCount: { increment: 1 },
      verifyState: "WAITING",
      verifyMailSentAt: now, // další ověřovací e-mail (s novými odkazy) za 24 h
      stateChangedAt: now,
    },
  });
  if (claimed.count !== 1) return { done: true, action };
  try {
    await sendPaymentReminder(order.id);
  } catch (err) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        reminderSentAt: before,
        reminderCount: order.reminderCount,
        verifyState: order.verifyState,
        verifyMailSentAt: order.verifyMailSentAt,
        stateChangedAt: order.stateChangedAt,
      },
    });
    throw err;
  }
  await audit({ action: "payment_reminder", orderId: order.id, detail: `upomínka č. ${order.reminderCount + 1}` }, ctx);
  return { done: true, action };
}

/**
 * Nezaplacená GoPay objednávka po lhůtě (reservation.gopay_minutes) přechází na platbu převodem / QR kódem:
 * zákazník dostane platební údaje s informací, že objednávka zatím není zaplacena, a ověřovatel hned ověřovací e-mail.
 * Box zůstává rezervovaný; pozdě dokončená platba v GoPay objednávku zaplatí i tak (notifikace GoPay).
 * Volající má předem ověřit stav platby v GoPay. Vrací true, když objednávku přepnul.
 */
export async function switchGopayToTransfer(orderId: number, now = new Date()): Promise<boolean> {
  const switched = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING", paymentMethod: "GOPAY" },
    data: { paymentMethod: "BANK_TRANSFER", reservedUntil: null, verifyState: "WAITING", stateChangedAt: now },
  });
  if (switched.count !== 1) return false;
  await audit({ action: "gopay_switched_to_transfer", orderId }, { source: "system" });

  const order = await loadOrder({ id: orderId });
  if (!order) return true;
  try {
    const settings = await getSettings();
    const transfer = transferInstructions(settings.str("bank.account"), order.totalCzk, order.number, settings.str("seller.name"));
    const mail = transferSwitchMail(order, settings, { orderUrl: orderUrl(order.publicToken), transfer, qrCid: "qr-platba" });
    await sendMail({
      to: order.email,
      ...mail,
      attachments: [{ filename: "qr-platba.png", content: await qrPng(transfer.spd), cid: "qr-platba" }],
      replyTo: customerReplyTo(settings),
    });
  } catch (err) {
    console.error("[verify] switch mail failed", orderId, err);
  }
  // ověřovatel ve stejnou chvíli; při chybě ho dorovná opakování (resendPendingVerifications)
  await sendVerifyMail(orderId, { now }).catch((err) => console.error("[verify] verify mail failed", orderId, err));
  return true;
}

/** Opakované kliknutí na „Zaplatil jsem“ v této době už další ověřovací e-mail neposílá */
export const CLAIM_RESEND_MS = 10 * 60_000;

/**
 * Zákazník klikl „Zaplatil jsem“ (jen z upomínky): zaznamená čas a ověřovateli hned pošle ověřovací e-mail „Zákazník hlásí platbu“
 * s novými jednorázovými odkazy (starší přestanou platit, 24h cyklus začne znovu). Stav objednávky nemění;
 * pokud ji admin řešil ručně („vyřeším sám“), ověřování znovu zapne. Opakované kliknutí do 10 minut e-mail
 * znovu neposílá. Vrací objednávku, nebo null, když nejde o nezaplacenou objednávku převodem.
 */
export async function claimPayment(publicToken: string, ip: string | null, now = new Date()) {
  const order = await loadOrder({ publicToken });
  if (!order || !isOpenTransfer(order)) return null;
  if (order.paymentClaimedAt && now.getTime() - order.paymentClaimedAt.getTime() < CLAIM_RESEND_MS) return order;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentClaimedAt: now,
      verifyState: "WAITING",
      ...(order.verifyState !== "WAITING" ? { stateChangedAt: now } : {}),
    },
  });
  await audit({ action: "payment_claimed", orderId: order.id }, { source: "customer", ip });
  await sendVerifyMail(order.id, { claimed: true, now }).catch((err) => console.error("[verify] claim mail failed", order.id, err));
  return order;
}
