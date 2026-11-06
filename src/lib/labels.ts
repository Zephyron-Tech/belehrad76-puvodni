import type { DeliveryMethod, OrderStatus, PaymentMethod } from "@prisma/client";
import { formatDate } from "./format";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Přijatá – čeká na platbu",
  PAID: "Zaplacená",
  SHIPPED: "Odeslaná",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
};

/** U osobního převzetí se „odeslaná“ zobrazuje jako „připravená k převzetí“. */
export function statusLabel(status: OrderStatus, delivery: DeliveryMethod): string {
  if (status === "SHIPPED" && delivery === "PICKUP") return "Připravená k převzetí";
  return STATUS_LABEL[status];
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  GOPAY: "Kartou / online převodem (GoPay)",
  BANK_TRANSFER: "Bankovním převodem / QR kódem",
};

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  SHIPPING: "Kurýr na adresu",
  PACKETA: "Zásilkovna – výdejní místo",
  PICKUP: "Osobní převzetí na FAČR",
};

/** Upozornění k losování o vstup na slavnostní večer (potvrzení objednávky) */
export const EVENING_ENTRY_NOTE = "Vstup pouze pro 1 osobu na 1 zakoupený box.";

/** Stav ověření platby převodem (SPECIFIKACE 5b), jen u nezaplacené objednávky převodem; jinak null. */
export function transferVerifyLabel(order: {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  verifyState: "WAITING" | "MANUAL" | null;
  reminderCount: number;
}): string | null {
  if (order.status !== "PENDING" || order.paymentMethod !== "BANK_TRANSFER" || !order.verifyState) return null;
  if (order.verifyState === "MANUAL") return "Nezaplaceno – řeší admin";
  return order.reminderCount > 0 ? "Upomínka odeslána – čeká na ověření" : "Čeká na ověření platby";
}

/**
 * Informace pro zákazníka u platby převodem: „Pokud platbu neobdržíme do 7 dní (do 13. 11. 2026), objednávku zrušíme.“
 * Jen text – automaticky se nic neruší (SPECIFIKACE 5b). Bez data (`from`) jen počet dní.
 */
export function transferCancelNotice(days: number, from?: Date | null): string {
  if (!days) return "";
  const until = from ? ` (do ${formatDate(new Date(from.getTime() + days * 24 * 3_600_000))})` : "";
  return `Pokud platbu neobdržíme do ${days} dní${until}, objednávku zrušíme.`;
}
