import { prisma } from "../db";
import { env } from "../env";
import { getSettings, type Settings } from "../settings";
import { sendMail } from "../mail/transport";
import { orderReceivedMail, ownerPaidMail, paymentConfirmedMail, shippedMail } from "../mail/templates";
import { paymentConfirmationPdf } from "../pdf";
import { qrPng, transferInstructions } from "../bank";
import { sendMetaPurchase } from "../meta-capi";

type ClaimField = "paymentConfirmationSentAt" | "ownerNotifiedAt" | "shippedMailSentAt" | "capiSentAt";

/**
 * Jednorázové odeslání: nastaví časové razítko jen pokud ještě není nastavené.
 * Když odeslání selže, razítko se vrátí, aby šlo akci zopakovat.
 */
async function once(orderId: number, field: ClaimField, action: () => Promise<unknown>) {
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, [field]: null },
    data: { [field]: new Date() },
  });
  if (claimed.count !== 1) return false;
  try {
    await action();
    return true;
  } catch (err) {
    await prisma.order.update({ where: { id: orderId }, data: { [field]: null } });
    throw err;
  }
}

/** Kam odpovídá zákazník: mail.reply_to (může být víc adres oddělených čárkou), jinak contact.email. */
function customerReplyTo(settings: Settings) {
  return settings.str("mail.reply_to").trim() || settings.str("contact.email") || undefined;
}

function orderLink(token: string) {
  return `${env.appUrl}/objednavka/${token}`;
}

export async function sendOrderReceived(orderId: number) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const settings = await getSettings();

  let transfer;
  const attachments = [];
  if (order.paymentMethod === "BANK_TRANSFER") {
    transfer = transferInstructions(settings.str("bank.account"), order.totalCzk, order.number, settings.str("seller.name"));
    if (settings.bool("payment.bank_transfer")) {
      attachments.push({ filename: "qr-platba.png", content: await qrPng(transfer.spd), cid: "qr-platba" });
    }
  }

  const mail = orderReceivedMail(order, settings, {
    orderUrl: orderLink(order.publicToken),
    transfer,
    qrCid: attachments.length > 0 ? "qr-platba" : undefined,
  });
  await sendMail({ to: order.email, ...mail, attachments, replyTo: customerReplyTo(settings) });
}

/** Po zaplacení: potvrzení s PDF zákazníkovi, upozornění provozovateli, Meta CAPI. */
export async function sendPaidNotifications(orderId: number, opts: { oversold?: boolean } = {}) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const settings = await getSettings();
  const errors: unknown[] = [];

  await once(orderId, "paymentConfirmationSentAt", async () => {
    const pdf = await paymentConfirmationPdf(order, settings);
    const mail = paymentConfirmedMail(order, settings, { orderUrl: orderLink(order.publicToken) });
    await sendMail({
      to: order.email,
      ...mail,
      replyTo: customerReplyTo(settings),
      attachments: [{ filename: `potvrzeni-platby-${order.number}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
  }).catch((e) => errors.push(e));

  const ownerEmail = settings.str("owner.notify_email");
  if (ownerEmail) {
    await once(orderId, "ownerNotifiedAt", async () => {
      const mail = ownerPaidMail(order, settings, {
        adminUrl: `${env.appUrl}/admin/objednavky/${order.id}`,
        oversold: !!opts.oversold,
      });
      await sendMail({ to: ownerEmail, ...mail, replyTo: order.email });
    }).catch((e) => errors.push(e));
  }

  if (order.trackingConsent) {
    await once(orderId, "capiSentAt", async () => {
      const sent = await sendMetaPurchase(order);
      if (!sent) throw new Error("skip");
    }).catch((e) => {
      if (!(e instanceof Error && e.message === "skip")) errors.push(e);
    });
  }

  if (errors.length) throw new AggregateError(errors, "Některé notifikace se nepodařilo odeslat.");
}

export async function sendShippedNotification(orderId: number) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const settings = await getSettings();
  await once(orderId, "shippedMailSentAt", async () => {
    const mail = shippedMail(order, settings, { orderUrl: orderLink(order.publicToken) });
    await sendMail({ to: order.email, ...mail, replyTo: customerReplyTo(settings) });
  });
}
