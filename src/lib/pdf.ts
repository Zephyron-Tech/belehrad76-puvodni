import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Settings } from "./settings";
import type { OrderWithItems } from "./mail/templates";
import { formatCzk, formatDateTime, formatZip } from "./format";
import { DELIVERY_LABEL, PAYMENT_LABEL } from "./labels";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontCache: { regular: Buffer; bold: Buffer } | null = null;

async function loadFonts() {
  if (!fontCache) {
    const [regular, bold] = await Promise.all([
      fs.readFile(path.join(FONT_DIR, "DejaVuSans.ttf")),
      fs.readFile(path.join(FONT_DIR, "DejaVuSans-Bold.ttf")),
    ]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

const INK = rgb(0.106, 0.09, 0.07);
const MUTED = rgb(0.42, 0.38, 0.32);
const GOLD = rgb(0.66, 0.51, 0.24);

/**
 * PDF „Potvrzení o přijetí platby“ – posílá se zákazníkovi po zaplacení.
 * Nejde o fakturu (daňový doklad), faktury se v e-shopu nevystavují.
 */
export async function paymentConfirmationPdf(order: OrderWithItems, settings: Settings): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await loadFonts();
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });

  pdf.setTitle(`Potvrzení o přijetí platby – objednávka ${order.number}`);
  pdf.setAuthor(settings.str("seller.name"));
  pdf.setCreator("Mistři Evropy – Bělehrad 1976");

  const page = pdf.addPage([595.28, 841.89]); // A4
  const left = 50;
  const right = 545;
  let y = 790;

  const text = (t: string, x: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) =>
    page.drawText(t, { x, y: yy, font: opts.font ?? regular, size: opts.size ?? 10, color: opts.color ?? INK });
  const textRight = (t: string, xRight: number, yy: number, font: PDFFont = regular, size = 10) =>
    page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y: yy, font, size, color: INK });

  // Hlavička
  text("MISTŘI EVROPY", left, y, { font: bold, size: 18, color: GOLD });
  textRight("BĚLEHRAD 1976", right, y + 2, bold, 11);
  y -= 34;
  text("Potvrzení o přijetí platby", left, y, { font: bold, size: 16 });
  y -= 18;
  text(`Objednávka č. ${order.number}`, left, y, { size: 11 });
  y -= 30;

  // Prodávající / zákazník
  const colRight = 310;
  text("Prodávající", left, y, { font: bold, size: 10, color: MUTED });
  text("Zákazník", colRight, y, { font: bold, size: 10, color: MUTED });
  y -= 15;

  const sellerLines = [
    settings.str("seller.name"),
    settings.str("seller.address"),
    `IČO: ${settings.str("seller.ico")}`,
    `DIČ: ${settings.str("seller.dic")}`,
  ];
  const customerLines = [
    order.companyName || `${order.firstName} ${order.lastName}`,
    ...(order.companyName ? [`${order.firstName} ${order.lastName}`] : []),
    ...(order.street ? [order.street, `${formatZip(order.zip)} ${order.city ?? ""}`.trim()] : []),
    ...(order.ico ? [`IČO: ${order.ico}`] : []),
    ...(order.dic ? [`DIČ: ${order.dic}`] : []),
    order.email,
  ];
  const rows = Math.max(sellerLines.length, customerLines.length);
  for (let i = 0; i < rows; i++) {
    if (sellerLines[i]) text(wrap(sellerLines[i], regular, 10, colRight - left - 10), left, y);
    if (customerLines[i]) text(wrap(customerLines[i], regular, 10, right - colRight), colRight, y);
    y -= 14;
  }
  y -= 16;

  // Údaje o platbě
  const meta: [string, string][] = [
    ["Datum objednávky", formatDateTime(order.createdAt)],
    ["Datum přijetí platby", formatDateTime(order.paidAt ?? new Date())],
    ["Způsob platby", PAYMENT_LABEL[order.paymentMethod]],
    ["Variabilní symbol", order.number],
    [
      "Způsob dodání",
      order.deliveryMethod === "PACKETA" && order.packetaPointName
        ? `Zásilkovna – ${order.packetaPointName}`
        : DELIVERY_LABEL[order.deliveryMethod],
    ],
  ];
  for (const [label, value] of meta) {
    text(label, left, y, { color: MUTED });
    text(wrap(value, regular, 10, right - left - 150), left + 150, y);
    y -= 15;
  }
  y -= 14;

  // Položky
  drawLine(page, left, right, y + 12);
  text("Položka", left, y, { font: bold });
  textRight("Množství", 380, y, bold);
  textRight("Cena/ks", 460, y, bold);
  textRight("Celkem", right, y, bold);
  y -= 8;
  drawLine(page, left, right, y);
  y -= 16;

  for (const item of order.items) {
    text(wrap(item.name, regular, 10, 280), left, y);
    textRight(`${item.quantity}×`, 380, y);
    textRight(formatCzk(item.unitPriceCzk), 460, y);
    textRight(formatCzk(item.unitPriceCzk * item.quantity), right, y);
    y -= 17;
  }
  text(`Doprava – ${DELIVERY_LABEL[order.deliveryMethod]}`, left, y);
  textRight(order.shippingCzk ? formatCzk(order.shippingCzk) : "zdarma", right, y);
  y -= 10;
  drawLine(page, left, right, y, 1.2);
  y -= 20;
  text("Zaplaceno celkem", left, y, { font: bold, size: 12 });
  textRight(formatCzk(order.totalCzk), right, y, bold, 12);
  y -= 16;
  text("Ceny jsou uvedeny včetně DPH.", left, y, { size: 9, color: MUTED });
  y -= 40;

  // Patička
  const notes = [
    "Tímto potvrzujeme přijetí platby za výše uvedenou objednávku.",
    "Tento dokument je potvrzením o zaplacení, nejde o daňový doklad.",
    "Výtěžek edice jde na podporu Nadace fotbalových internacionálů.",
  ];
  for (const n of notes) {
    text(n, left, y, { size: 9.5, color: MUTED });
    y -= 14;
  }

  page.drawText(`${settings.str("seller.name")} · ${settings.str("contact.email")}`, {
    x: left,
    y: 40,
    font: regular,
    size: 8,
    color: MUTED,
  });

  return Buffer.from(await pdf.save());
}

function drawLine(page: PDFPage, x1: number, x2: number, y: number, thickness = 0.6) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: rgb(0.8, 0.77, 0.7) });
}

/** Zkrátí text, aby se vešel do šířky (jednořádkové sloupce). */
function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let s = value;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}
