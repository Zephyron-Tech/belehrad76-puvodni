import type { Order, OrderItem } from "@prisma/client";
import type { Settings } from "../settings";
import { formatCzk, formatDateTime, formatZip } from "../format";
import { DELIVERY_LABEL, EVENING_ENTRY_NOTE, PAYMENT_LABEL, transferCancelNotice } from "../labels";
import { formatIban, type TransferInstructions } from "../bank";

export type OrderWithItems = Order & { items: OrderItem[] };

export function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/*
 * Vzhled e-mailů podle e-shopu: tmavé pozadí, zlatá, krémová, patkové písmo v nadpisech.
 * Barvy jsou i v atributech bgcolor – kvůli Outlooku a tmavému režimu poštovních klientů.
 */
const C = {
  ink: "#0f0d0b",
  panel: "#19150f",
  panel2: "#221c15",
  line: "#3a3026",
  gold: "#c9a35c",
  goldLight: "#e6c98f",
  cream: "#f3ead9",
  muted: "#a89c86",
  seal: "#b3262d",
};
const SERIF = "Georgia,'Times New Roman',Times,serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

/** Malý nadpis sekce: verzálky s prostrkáním a linkou. */
function sectionTitle(label: string): string {
  return `<tr><td style="padding:28px 40px 10px;">
<div style="font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.gold};">${esc(label)}</div>
<div style="height:1px;line-height:1px;font-size:1px;background:${C.line};margin-top:10px;">&nbsp;</div>
</td></tr>`;
}

/** Řádky „popisek – hodnota“ (hodnoty už escapované). */
function rows(items: [string, string][], opts: { strongLast?: boolean } = {}): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${SANS};font-size:14px;">
${items
  .map(([label, value], i) => {
    const last = opts.strongLast && i === items.length - 1;
    return `<tr>
<td style="padding:7px 12px 7px 0;color:${C.muted};vertical-align:top;">${esc(label)}</td>
<td style="padding:7px 0;color:${last ? C.goldLight : C.cream};text-align:right;vertical-align:top;${last ? `font-family:${SERIF};font-size:20px;` : ""}">${value}</td>
</tr>`;
  })
  .join("")}
</table>`;
}

/**
 * Status nahoře. Objednávka: obrysová pečeť a „čeká na úhradu“. Platba: plná zlatá pečeť s fajfkou.
 * Rozdíl mezi přijatou objednávkou a přijatou platbou je tak vidět na první pohled.
 */
function statusBlock(kind: "pending" | "paid" | "neutral", label: string, sub: string): string {
  const seal =
    kind === "paid"
      ? `<td align="center" bgcolor="${C.gold}" style="background:${C.gold};width:64px;height:64px;border-radius:32px;font-family:${SERIF};font-size:30px;line-height:64px;color:${C.ink};">&#10003;</td>`
      : `<td align="center" style="width:62px;height:62px;border:1px solid ${kind === "pending" ? C.gold : C.line};border-radius:32px;font-family:${SERIF};font-size:13px;letter-spacing:1px;line-height:62px;color:${C.gold};">1976</td>`;
  return `<tr><td align="center" style="padding:34px 40px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${seal}</tr></table>
<div style="font-family:${SERIF};font-size:30px;line-height:1.2;color:${kind === "paid" ? C.goldLight : C.cream};margin-top:18px;">${esc(label)}</div>
<div style="font-family:${SANS};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${kind === "pending" ? C.gold : C.muted};margin-top:8px;">${esc(sub)}</div>
</td></tr>`;
}

/** Odstavec textu (html už escapované). */
function para(html: string, opts: { muted?: boolean; center?: boolean } = {}): string {
  return `<tr><td style="padding:12px 40px 0;font-family:${SANS};font-size:14px;line-height:1.7;color:${opts.muted ? C.muted : C.cream};${opts.center ? "text-align:center;" : ""}">${html}</td></tr>`;
}

function button(href: string, label: string): string {
  return `<tr><td align="center" style="padding:28px 40px 4px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${C.gold}" style="background:${C.gold};">
<a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${C.ink};text-decoration:none;">${esc(label)}</a>
</td></tr></table>
</td></tr>`;
}

/** Upozornění u platby převodem / QR: ať zákazník neplatí dvakrát. */
const ALREADY_PAID_TRANSFER =
  "Pokud jste již zaplatili QR kódem nebo převodem ze stránky objednávky na našem webu, nic dalšího neplaťte – potvrzení vám zašleme, jakmile platbu přijmeme.";
const ALREADY_PAID_SWITCHED =
  "Pokud jste již zaplatili v platební bráně, QR kódem nebo převodem ze stránky objednávky, nic dalšího neplaťte – potvrzení vám zašleme, jakmile platbu přijmeme.";

/** Zvýrazněné sdělení: zlatá linka vlevo, světlejší podklad. */
function notice(html: string): string {
  return `<tr><td style="padding:24px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td bgcolor="${C.panel2}" style="background:${C.panel2};border-left:2px solid ${C.gold};padding:16px 20px;font-family:${SANS};font-size:14px;line-height:1.7;color:${C.cream};">${html}</td>
</tr></table>
</td></tr>`;
}

function outlineButton(href: string, label: string): string {
  return `<tr><td align="center" style="padding:12px 40px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border:1px solid ${C.gold};">
<a href="${esc(href)}" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${C.goldLight};text-decoration:none;">${esc(label)}</a>
</td></tr></table>
</td></tr>`;
}

/** Platební údaje převodem: účet, IBAN, VS, částka, QR, doba ověření a informace o zrušení. */
function transferBlock(
  settings: Settings,
  t: TransferInstructions,
  opts: { orderUrl: string; qrCid?: string; cancelFrom: Date; claimButton?: boolean },
): string {
  const qr = opts.qrCid
    ? `<td style="width:164px;padding-left:24px;vertical-align:top;" align="right">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px;"><img src="cid:${opts.qrCid}" width="140" height="140" alt="QR platba" style="display:block;"></td></tr></table>
<div style="font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-top:8px;text-align:center;">QR platba</div>
</td>`
    : "";
  const verifyTime = settings.str("payment.verify_time");
  return `${sectionTitle("Platební údaje")}
<tr><td style="padding:4px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;">${rows(
    [
      ["Číslo účtu", `<strong>${esc(t.account)}</strong>`],
      ["IBAN", esc(formatIban(t.iban))],
      ["Variabilní symbol", `<strong>${esc(t.variableSymbol)}</strong>`],
      ["K úhradě", formatCzk(t.amountCzk)],
    ],
    { strongLast: true },
  )}</td>
${qr}
</tr></table>
</td></tr>
${para(`Platbu prosím odešlete na uvedený účet, nebo naskenujte QR kód v aplikaci své banky.${verifyTime ? ` Ověření platby obvykle trvá ${esc(verifyTime)}` : ""}${verifyTime ? "; jakmile ji přijmeme, zašleme vám potvrzení." : " Jakmile ji přijmeme, zašleme vám potvrzení."}`, { muted: true })}
${para(esc(transferCancelNotice(settings.num("reservation.transfer_days"), opts.cancelFrom)), { muted: true })}
${opts.claimButton ? button(claimUrl(opts.orderUrl), "Zaplatil jsem") : ""}`;
}

/** Odkaz z upomínky na stránku objednávky, kde zákazník potvrdí „Zaplatil jsem“ (GET nic nemění). */
function claimUrl(orderUrl: string) {
  return `${orderUrl}?upominka=1#zaplatil`;
}

function transferText(
  settings: Settings,
  t: TransferInstructions,
  orderUrl: string,
  cancelFrom: Date,
  opts: { claimButton?: boolean } = {},
): string {
  const verifyTime = settings.str("payment.verify_time");
  const cancel = transferCancelNotice(settings.num("reservation.transfer_days"), cancelFrom);
  return `PLATEBNÍ ÚDAJE\nČíslo účtu: ${t.account}\nIBAN: ${t.iban}\nVariabilní symbol: ${t.variableSymbol}\nK úhradě: ${formatCzk(t.amountCzk)}\n\nPlatbu prosím odešlete na uvedený účet, nebo naskenujte QR kód v aplikaci své banky.\n${verifyTime ? `Ověření platby obvykle trvá ${verifyTime}.\n` : ""}${cancel ? `${cancel}\n` : ""}${opts.claimButton ? `\nZaplatil jsem: ${claimUrl(orderUrl)}\n` : ""}`;
}

function layout(settings: Settings, title: string, body: string, preheader: string): string {
  const phone = settings.str("contact.phone");
  const email = settings.str("contact.email");
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.ink};" bgcolor="${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ink};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.ink}" style="background:${C.ink};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="${C.panel}" style="width:100%;max-width:600px;background:${C.panel};border:1px solid ${C.line};">
<tr><td align="center" style="padding:40px 40px 30px;border-bottom:1px solid ${C.line};">
<div style="font-family:${SANS};font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${C.muted};">Limitovaná edice</div>
<div style="font-family:${SERIF};font-size:30px;letter-spacing:6px;color:${C.gold};margin-top:12px;">MISTŘI EVROPY</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
<td style="width:42px;vertical-align:middle;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.gold};">&nbsp;</div></td>
<td style="padding:0 12px;font-family:${SERIF};font-size:13px;letter-spacing:5px;color:${C.cream};white-space:nowrap;">BĚLEHRAD 1976</td>
<td style="width:42px;vertical-align:middle;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.gold};">&nbsp;</div></td>
</tr></table>
</td></tr>
${body}
<tr><td style="padding:40px 40px 0;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.line};">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:24px 40px 36px;font-family:${SANS};font-size:11px;line-height:1.8;color:${C.muted};">
Výtěžek edice jde na podporu Nadace fotbalových internacionálů.<br>
${esc(settings.str("seller.name"))} · IČO ${esc(settings.str("seller.ico"))} · ${esc(settings.str("seller.address"))}<br>
${email ? `<a href="mailto:${esc(email)}" style="color:${C.gold};text-decoration:none;">${esc(email)}</a>` : ""}${phone ? ` · ${esc(phone)}` : ""}<br>
Prodej alkoholu osobám mladším 18 let je zakázán.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function itemsTable(order: OrderWithItems): string {
  const cell = `border-bottom:1px solid ${C.line};vertical-align:top;`;
  const items = order.items
    .map(
      (i) => `<tr>
<td style="padding:12px 12px 12px 0;${cell}">
<div style="font-family:${SERIF};font-size:16px;color:${C.cream};">${esc(i.name)}</div>
<div style="font-family:${SANS};font-size:12px;color:${C.muted};margin-top:3px;">${i.quantity} × ${formatCzk(i.unitPriceCzk)}${i.madeToOrder ? " · vyrábí se na objednávku" : ""}</div>
</td>
<td style="padding:12px 0;${cell}text-align:right;white-space:nowrap;font-family:${SANS};font-size:14px;color:${C.cream};">${formatCzk(i.unitPriceCzk * i.quantity)}</td>
</tr>`,
    )
    .join("");
  return `<tr><td style="padding:0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${items}
<tr>
<td style="padding:12px 12px 12px 0;${cell}font-family:${SANS};font-size:14px;color:${C.muted};">Doprava – ${esc(DELIVERY_LABEL[order.deliveryMethod])}</td>
<td style="padding:12px 0;${cell}text-align:right;white-space:nowrap;font-family:${SANS};font-size:14px;color:${C.cream};">${order.shippingCzk ? formatCzk(order.shippingCzk) : "zdarma"}</td>
</tr>
<tr>
<td style="padding:16px 0 0;font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.muted};">Celkem vč. DPH</td>
<td style="padding:16px 0 0;text-align:right;white-space:nowrap;font-family:${SERIF};font-size:24px;color:${C.goldLight};">${formatCzk(order.totalCzk)}</td>
</tr>
</table>
</td></tr>`;
}

function itemsText(order: OrderWithItems): string {
  return [
    ...order.items.map((i) => `${i.name}  ${i.quantity} × ${formatCzk(i.unitPriceCzk)} = ${formatCzk(i.unitPriceCzk * i.quantity)}`),
    `Doprava – ${DELIVERY_LABEL[order.deliveryMethod]}: ${order.shippingCzk ? formatCzk(order.shippingCzk) : "zdarma"}`,
    `Celkem vč. DPH: ${formatCzk(order.totalCzk)}`,
  ].join("\n");
}

function deliveryBlock(order: OrderWithItems, settings: Settings): string {
  let label: string;
  let lines: string[];
  if (order.deliveryMethod === "PICKUP") {
    label = "Osobní převzetí";
    lines = [settings.str("pickup.address"), settings.str("pickup.note")];
  } else if (order.deliveryMethod === "PACKETA") {
    label = "Zásilkovna – výdejní místo";
    lines = [order.packetaPointName ?? "", order.packetaPointAddress ?? ""];
  } else {
    label = "Doručovací adresa";
    lines = [`${order.firstName} ${order.lastName}`, order.street ?? "", `${formatZip(order.zip)} ${order.city ?? ""}`.trim()];
  }
  return `${sectionTitle(label)}
<tr><td style="padding:4px 40px 0;font-family:${SANS};font-size:14px;line-height:1.7;color:${C.cream};">${lines.filter(Boolean).map(esc).join("<br>")}</td></tr>`;
}

/** Doručení a dodací lhůta: box kurýrem (jen při doručení na adresu), kusovky na objednávku */
function notesBlock(order: OrderWithItems, settings: Settings): string {
  const notes: string[] = [];
  if (order.deliveryMethod === "SHIPPING" && order.items.some((i) => i.type === "BOX")) notes.push(settings.str("box.delivery"));
  if (order.items.some((i) => i.madeToOrder)) notes.push(settings.str("bottle.lead_time"));
  if (notes.filter(Boolean).length === 0) return "";
  return `<tr><td style="padding:22px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="border-left:2px solid ${C.gold};padding:2px 0 2px 16px;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.muted};">${notes.filter(Boolean).map(esc).join("<br>")}</td>
</tr></table>
</td></tr>`;
}

/** E-mail ihned po vytvoření objednávky – objednávka přijata, čeká na úhradu */
export function orderReceivedMail(
  order: OrderWithItems,
  settings: Settings,
  opts: { orderUrl: string; transfer?: TransferInstructions; qrCid?: string },
) {
  const title = `Potvrzení doručení objednávky ${order.number}`;
  let payment = "";
  let paymentText = "";

  // GoPay: bez platebních údajů (platí se v bráně, potvrzení přijde zvlášť). Převod: platební údaje + upozornění.
  const isTransfer = order.paymentMethod === "BANK_TRANSFER";
  const sub = isTransfer ? "Čeká na úhradu" : "Děkujeme za objednávku";
  const alreadyPaid = isTransfer ? notice(`<strong style="color:${C.goldLight};">Důležité:</strong> ${esc(ALREADY_PAID_TRANSFER)}`) : "";

  if (order.paymentMethod === "BANK_TRANSFER" && opts.transfer) {
    payment = transferBlock(settings, opts.transfer, { orderUrl: opts.orderUrl, qrCid: opts.qrCid, cancelFrom: order.createdAt });
    paymentText = transferText(settings, opts.transfer, opts.orderUrl, order.createdAt);
  }

  const html = layout(
    settings,
    title,
    `${statusBlock("pending", "Objednávku jsme obdrželi", sub)}
${para(`Objednávka č. <span style="color:${C.goldLight};">${esc(order.number)}</span> · ${esc(formatDateTime(order.createdAt))}`, { muted: true, center: true })}
${para("Děkujeme za vaši objednávku z limitované edice Mistři Evropy – Bělehrad 1976.", { center: true })}
${para("Toto je automatické potvrzení doručení objednávky. Přijetí objednávky vám potvrdíme samostatným e-mailem po přijetí platby.", { muted: true, center: true })}
${alreadyPaid}
${sectionTitle("Objednávka")}
${itemsTable(order)}
${payment}
${deliveryBlock(order, settings)}
${notesBlock(order, settings)}
${order.eveningInterest ? para(`Po zaplacení vás zařadíme do losování o vstup na galavečer ${esc(settings.str("evening.date"))}. ${esc(EVENING_ENTRY_NOTE)}`, { muted: true }) : ""}
`,
    isTransfer ? `Čeká na úhradu ${formatCzk(order.totalCzk)}.` : `Objednávku ${order.number} jsme obdrželi.`,
  );

  const text = `POTVRZENÍ DORUČENÍ OBJEDNÁVKY${isTransfer ? " – ČEKÁ NA ÚHRADU" : ""}\nObjednávka č. ${order.number}\n\nDěkujeme za vaši objednávku z limitované edice Mistři Evropy – Bělehrad 1976.\nToto je automatické potvrzení doručení objednávky. Přijetí objednávky vám potvrdíme samostatným e-mailem po přijetí platby.\n${isTransfer ? `\nDŮLEŽITÉ: ${ALREADY_PAID_TRANSFER}\n` : ""}\n${itemsText(order)}\n\n${paymentText}${order.eveningInterest ? `\nPo zaplacení vás zařadíme do losování o vstup na galavečer. ${EVENING_ENTRY_NOTE}\n` : ""}\nStav objednávky: ${opts.orderUrl}\n`;
  return { subject: title, html, text };
}

/** Potvrzení o přijetí platby (s PDF v příloze) */
export function paymentConfirmedMail(order: OrderWithItems, settings: Settings, opts: { orderUrl: string }) {
  const title = `Platba za objednávku ${order.number} přijata`;
  const paidAt = formatDateTime(order.paidAt ?? new Date());

  const html = layout(
    settings,
    title,
    `${statusBlock("paid", "Platba přijata", `Objednávka č. ${order.number}`)}
${para("Děkujeme. Vaše platba byla přijata a potvrzujeme přijetí vaší objednávky – objednávku nyní připravujeme.", { center: true })}
<tr><td style="padding:30px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.panel2}" style="background:${C.panel2};border:1px solid ${C.line};border-top:2px solid ${C.gold};"><tr><td style="padding:22px 24px 16px;">
<div style="font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.gold};padding-bottom:10px;">Potvrzení o přijetí platby</div>
${rows(
      [
        ["Číslo objednávky", esc(order.number)],
        ["Variabilní symbol", esc(order.number)],
        ["Datum přijetí platby", esc(paidAt)],
        ["Způsob platby", esc(PAYMENT_LABEL[order.paymentMethod])],
        ["Přijatá částka", formatCzk(order.totalCzk)],
      ],
      { strongLast: true },
    )}
</td></tr></table>
</td></tr>
${para("V příloze naleznete potvrzení o zaplacení a obchodní podmínky platné pro tuto objednávku (PDF). Potvrzení o zaplacení není daňový doklad.", { muted: true })}
${sectionTitle("Předmět platby")}
${itemsTable(order)}
${deliveryBlock(order, settings)}
${notesBlock(order, settings)}
${
  order.eveningInterest
    ? para(
        `Jste zařazeni do losování o vstup na galavečer ${esc(settings.str("evening.date"))}. ${esc(EVENING_ENTRY_NOTE)} O výsledku vás budeme informovat.`,
        { muted: true },
      )
    : ""
}
${para("O odeslání objednávky vás budeme informovat.", { muted: true })}
${button(opts.orderUrl, "Stav objednávky")}`,
    `Přijato ${formatCzk(order.totalCzk)} za objednávku ${order.number}.`,
  );

  const text = `POTVRZENÍ O PŘIJETÍ PLATBY\n\nČíslo objednávky: ${order.number}\nVariabilní symbol: ${order.number}\nDatum přijetí platby: ${paidAt}\nZpůsob platby: ${PAYMENT_LABEL[order.paymentMethod]}\nPřijatá částka: ${formatCzk(order.totalCzk)}\n\nPotvrzujeme přijetí vaší objednávky. V příloze naleznete potvrzení o zaplacení a obchodní podmínky platné pro tuto objednávku (PDF). Potvrzení o zaplacení není daňový doklad.\n\n${itemsText(order)}\n\n${order.eveningInterest ? `Jste zařazeni do losování o vstup na galavečer. ${EVENING_ENTRY_NOTE}\n\n` : ""}Stav objednávky: ${opts.orderUrl}\n`;
  return { subject: title, html, text };
}

/** Upozornění provozovateli na zaplacenou objednávku */
export function ownerPaidMail(order: OrderWithItems, settings: Settings, opts: { adminUrl: string; oversold: boolean }) {
  const title = `Zaplacená objednávka ${order.number} – ${formatCzk(order.totalCzk)}`;
  const billing = [order.companyName, order.ico && `IČO ${order.ico}`, order.dic && `DIČ ${order.dic}`].filter(Boolean).join(", ");
  const customer: [string, string][] = [
    ["Jméno", esc(`${order.firstName} ${order.lastName}`)],
    ["E-mail", esc(order.email)],
    ["Telefon", esc(order.phone)],
  ];
  if (billing) customer.push(["Fakturační údaje", esc(billing)]);
  customer.push(["Platba", esc(PAYMENT_LABEL[order.paymentMethod])], ["Zájem o slavnostní večer", order.eveningInterest ? "ANO" : "ne"]);

  const html = layout(
    settings,
    title,
    `${statusBlock("paid", "Zaplacená objednávka", `č. ${order.number}`)}
${
  opts.oversold
    ? `<tr><td style="padding:22px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${C.panel2}" style="background:${C.panel2};border-left:3px solid ${C.seal};padding:12px 16px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.cream};"><strong>Pozor:</strong> objednávka byla zaplacena přes GoPay až po vypršení rezervace a box už nebyl skladem. Vyřešte prosím ručně (vrácení peněz nebo box z rezervy).</td></tr></table></td></tr>`
    : ""
}
${sectionTitle("Zákazník")}
<tr><td style="padding:4px 40px 0;">${rows(customer)}</td></tr>
${order.note ? para(`Poznámka zákazníka: ${esc(order.note)}`, { muted: true }) : ""}
${sectionTitle("Objednávka")}
${itemsTable(order)}
${deliveryBlock(order, settings)}
${button(opts.adminUrl, "Otevřít v administraci")}`,
    `${order.firstName} ${order.lastName} – ${formatCzk(order.totalCzk)}`,
  );
  const text = `${title}\n\n${order.firstName} ${order.lastName}, ${order.email}, ${order.phone}\n${billing}\n\n${itemsText(order)}\n\nPlatba: ${PAYMENT_LABEL[order.paymentMethod]}\nDoprava: ${DELIVERY_LABEL[order.deliveryMethod]}\nVečer: ${order.eveningInterest ? "ANO" : "ne"}\n${order.note ? `Poznámka: ${order.note}\n` : ""}\n${opts.adminUrl}\n`;
  return { subject: title, html, text };
}

/** Odesláno dopravcem / připraveno k osobnímu převzetí */
export function shippedMail(order: OrderWithItems, settings: Settings, opts: { orderUrl: string }) {
  if (order.deliveryMethod === "PICKUP") {
    const title = `Objednávka ${order.number} je připravena k převzetí`;
    const html = layout(
      settings,
      title,
      `${statusBlock("neutral", "Připraveno k převzetí", `Objednávka č. ${order.number}`)}
${para("Vaše objednávka je připravena k osobnímu převzetí.", { center: true })}
${deliveryBlock(order, settings)}
${para("Při převzetí prosím uveďte číslo objednávky a prokažte se dokladem totožnosti (18+).", { muted: true })}`,
      `Objednávka ${order.number} čeká na převzetí.`,
    );
    const text = `PŘIPRAVENO K PŘEVZETÍ\nObjednávka č. ${order.number}\n\nAdresa: ${settings.str("pickup.address")}\n${settings.str("pickup.note")}\n\nPři převzetí prosím uveďte číslo objednávky a prokažte se dokladem totožnosti (18+).\n`;
    return { subject: title, html, text };
  }

  const title = `Objednávka ${order.number} byla odeslána`;
  const shipment: [string, string][] = [["Dopravce", esc(order.carrier)]];
  if (order.trackingNumber) shipment.push(["Číslo zásilky", `<strong>${esc(order.trackingNumber)}</strong>`]);

  const html = layout(
    settings,
    title,
    `${statusBlock("neutral", "Zásilka je na cestě", `Objednávka č. ${order.number}`)}
${sectionTitle("Zásilka")}
<tr><td style="padding:4px 40px 0;">${rows(shipment)}</td></tr>
${deliveryBlock(order, settings)}
${para(
  order.deliveryMethod === "PACKETA"
    ? "Jakmile zásilka dorazí na výdejní místo, Zásilkovna vám zašle kód k vyzvednutí. Zásilka obsahuje alkohol – při vyzvednutí se prosím prokažte dokladem totožnosti (18+)."
    : "Zásilka obsahuje alkohol – dopravce může při převzetí ověřit váš věk (18+).",
  { muted: true },
)}
${button(opts.orderUrl, "Stav objednávky")}`,
    `Objednávka ${order.number} je na cestě.`,
  );
  const text = `ZÁSILKA JE NA CESTĚ\nObjednávka č. ${order.number}\n\nDopravce: ${order.carrier}\n${order.trackingNumber ? `Číslo zásilky: ${order.trackingNumber}\n` : ""}\nStav objednávky: ${opts.orderUrl}\n`;
  return { subject: title, html, text };
}

/**
 * Ověřovací e-mail pro ověřovatele platby převodem (SPECIFIKACE 5b): údaje pro kontrolu v internetovém bankovnictví
 * a odkazy Zaplaceno / Nezaplaceno – vyřeším sám / Nezaplaceno – poslat upomínku (bez přihlášení).
 */
export function verifyPaymentMail(
  order: OrderWithItems,
  settings: Settings,
  opts: {
    transfer: TransferInstructions;
    repeat: boolean;
    /** Odesláno, protože zákazník klikl „Zaplatil jsem“ (v upomínce) */
    claimed?: boolean;
    links: { paid: string; manual: string; remind: string };
    adminUrl: string;
  },
) {
  const t = opts.transfer;
  const title = opts.claimed
    ? `Zákazník hlásí platbu: VS ${t.variableSymbol} – ${formatCzk(t.amountCzk)}`
    : opts.repeat
      ? `Stále neověřeno: VS ${t.variableSymbol} – ${formatCzk(t.amountCzk)}`
      : `Ověřte platbu: VS ${t.variableSymbol} – ${formatCzk(t.amountCzk)}`;
  const statusSub = opts.claimed
    ? `Zákazník hlásí zaplaceno · ${formatDateTime(order.paymentClaimedAt ?? new Date())}`
    : opts.repeat
      ? "Opakované upozornění · zatím nerozhodnuto"
      : `Převodem · objednávka č. ${order.number}`;
  const billing = [order.companyName, order.ico && `IČO ${order.ico}`, order.dic && `DIČ ${order.dic}`].filter(Boolean).join(", ");

  const lookup: [string, string][] = [
    ["Variabilní symbol", `<span style="font-family:${SERIF};font-size:22px;color:${C.goldLight};">${esc(t.variableSymbol)}</span>`],
    ["Částka", `<span style="font-family:${SERIF};font-size:22px;color:${C.goldLight};">${formatCzk(t.amountCzk)}</span>`],
    ["Na účet", esc(t.account)],
    ["IBAN", esc(formatIban(t.iban))],
    ["Objednáno", esc(formatDateTime(order.createdAt))],
  ];
  if (order.paymentClaimedAt) lookup.push(["Zákazník hlásí zaplaceno", esc(formatDateTime(order.paymentClaimedAt))]);
  if (order.reminderCount > 0) lookup.push(["Upomínky", `${order.reminderCount}× (poslední ${esc(formatDateTime(order.reminderSentAt))})`]);

  const customer: [string, string][] = [
    ["Jméno", esc(`${order.firstName} ${order.lastName}`)],
    ["E-mail", esc(order.email)],
    ["Telefon", esc(order.phone)],
  ];
  if (billing) customer.push(["Fakturační údaje", esc(billing)]);

  const html = layout(
    settings,
    title,
    `${statusBlock("pending", "Ověřte platbu", statusSub)}
${para("V internetovém bankovnictví vyhledejte příchozí platbu s tímto variabilním symbolem a částkou.", { muted: true, center: true })}
<tr><td style="padding:24px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.panel2}" style="background:${C.panel2};border:1px solid ${C.line};border-top:2px solid ${C.gold};"><tr><td style="padding:18px 24px 14px;">
${rows(lookup)}
</td></tr></table>
</td></tr>
${button(opts.links.paid, "Zaplaceno")}
${outlineButton(opts.links.remind, "Nezaplaceno – poslat upomínku")}
${outlineButton(opts.links.manual, "Nezaplaceno – vyřeším sám")}
${para("Odkazy jsou jednorázové: otevřou stránku se shrnutím a potvrzuje se tlačítkem. Po prvním rozhodnutí přestanou platit všechny odkazy v tomto e-mailu. Fungují bez přihlášení – e-mail proto nepřeposílejte. Úplné zrušení objednávky (uvolnění boxu) jen v administraci.", { muted: true, center: true })}
${sectionTitle("Zákazník")}
<tr><td style="padding:4px 40px 0;">${rows(customer)}</td></tr>
${sectionTitle("Objednávka")}
${itemsTable(order)}
${deliveryBlock(order, settings)}
${outlineButton(opts.adminUrl, "Otevřít v administraci")}`,
    `VS ${t.variableSymbol}, ${formatCzk(t.amountCzk)}, ${order.firstName} ${order.lastName}`,
  );

  const text = `${opts.claimed ? "ZÁKAZNÍK HLÁSÍ PLATBU" : opts.repeat ? "STÁLE NEOVĚŘENO" : "OVĚŘTE PLATBU"} – objednávka ${order.number}

V internetovém bankovnictví vyhledejte příchozí platbu:
Variabilní symbol: ${t.variableSymbol}
Částka: ${formatCzk(t.amountCzk)}
Na účet: ${t.account} (IBAN ${t.iban})
Objednáno: ${formatDateTime(order.createdAt)}
${order.paymentClaimedAt ? `Zákazník hlásí zaplaceno: ${formatDateTime(order.paymentClaimedAt)}\n` : ""}${order.reminderCount > 0 ? `Upomínky: ${order.reminderCount}×\n` : ""}
Zaplaceno: ${opts.links.paid}
Nezaplaceno – poslat upomínku: ${opts.links.remind}
Nezaplaceno – vyřeším sám: ${opts.links.manual}
(Odkazy jsou jednorázové – po prvním rozhodnutí přestanou platit všechny.)

${order.firstName} ${order.lastName}, ${order.email}, ${order.phone}${billing ? `\n${billing}` : ""}

${itemsText(order)}

Administrace: ${opts.adminUrl}
`;
  return { subject: title, html, text };
}

/** Upomínka zákazníkovi: platba převodem zatím nedorazila. Platební údaje a QR kód. */
export function paymentReminderMail(
  order: OrderWithItems,
  settings: Settings,
  opts: { orderUrl: string; transfer: TransferInstructions; qrCid?: string },
) {
  const title = `Připomínka platby – objednávka ${order.number}`;
  const html = layout(
    settings,
    title,
    `${statusBlock("pending", "Připomínka platby", `Objednávka č. ${order.number}`)}
${para("Dovolujeme si připomenout, že platbu za vaši objednávku jsme dosud neobdrželi. Pokud jste ji mezitím odeslali, klikněte prosím na „Zaplatil jsem“ – platbu ověříme přednostně.", { center: true })}
${transferBlock(settings, opts.transfer, { orderUrl: opts.orderUrl, qrCid: opts.qrCid, cancelFrom: new Date(), claimButton: true })}
${sectionTitle("Objednávka")}
${itemsTable(order)}
${deliveryBlock(order, settings)}`,
    `Čekáme na platbu ${formatCzk(order.totalCzk)} za objednávku ${order.number}.`,
  );
  const text = `PŘIPOMÍNKA PLATBY\nObjednávka č. ${order.number}\n\nDovolujeme si připomenout, že platbu za vaši objednávku jsme dosud neobdrželi. Pokud jste ji mezitím odeslali, klikněte prosím na „Zaplatil jsem“ – platbu ověříme přednostně.\n\n${transferText(settings, opts.transfer, opts.orderUrl, new Date(), { claimButton: true })}\n${itemsText(order)}\n`;
  return { subject: title, html, text };
}

/**
 * Nezaplacená GoPay objednávka po lhůtě (reservation.gopay_minutes) přechází na platbu převodem / QR kódem
 * (SPECIFIKACE 5b): zákazníkovi platební údaje s informací, že objednávka zatím není zaplacena.
 */
export function transferSwitchMail(
  order: OrderWithItems,
  settings: Settings,
  opts: { orderUrl: string; transfer: TransferInstructions; qrCid?: string },
) {
  const title = `Objednávka ${order.number} zatím není zaplacena`;
  const html = layout(
    settings,
    title,
    `${statusBlock("pending", "Objednávka zatím není zaplacena", `Objednávka č. ${order.number}`)}
${para("Platbu v platební bráně jsme od vás neobdrželi. Objednávku můžete dokončit bankovním převodem – stačí naskenovat QR kód v aplikaci své banky.", { center: true })}
${notice(`<strong style="color:${C.goldLight};">Důležité:</strong> ${esc(ALREADY_PAID_SWITCHED)}`)}
${transferBlock(settings, opts.transfer, { orderUrl: opts.orderUrl, qrCid: opts.qrCid, cancelFrom: new Date() })}
${sectionTitle("Objednávka")}
${itemsTable(order)}
${deliveryBlock(order, settings)}`,
    `Platba za objednávku ${order.number} zatím nedorazila – platební údaje uvnitř.`,
  );
  const text = `OBJEDNÁVKA ZATÍM NENÍ ZAPLACENA\nObjednávka č. ${order.number}\n\nPlatbu v platební bráně jsme od vás neobdrželi. Objednávku můžete dokončit bankovním převodem – stačí naskenovat QR kód v aplikaci své banky.\n\nDŮLEŽITÉ: ${ALREADY_PAID_SWITCHED}\n\n${transferText(settings, opts.transfer, opts.orderUrl, new Date())}\n${itemsText(order)}\n`;
  return { subject: title, html, text };
}

/** Zrušení objednávky – zákazníkovi. U zaplacené objednávky informace o vrácení peněz. */
export function cancelledMail(order: OrderWithItems, settings: Settings, opts: { wasPaid: boolean }) {
  const title = `Objednávka ${order.number} byla zrušena`;
  const contact = settings.str("contact.email");
  const refund = `Zaplacenou částku ${formatCzk(order.totalCzk)} vám vrátíme stejným způsobem, jakým jste platili. O vrácení vás budeme informovat.`;
  const unpaid = `Pokud jste mezitím platbu odeslali, ozvěte se nám prosím${contact ? ` na ${contact}` : ""} – platbu dohledáme a vrátíme.`;
  const html = layout(
    settings,
    title,
    `${statusBlock("neutral", "Objednávka zrušena", `Objednávka č. ${order.number}`)}
${para("Vaše objednávka byla zrušena.", { center: true })}
${opts.wasPaid ? notice(esc(refund)) : para(esc(unpaid), { muted: true, center: true })}
${sectionTitle("Zrušená objednávka")}
${itemsTable(order)}
${para(`Děkujeme za váš zájem o limitovanou edici Mistři Evropy – Bělehrad 1976. S dotazy se na nás neváhejte obrátit${contact ? ` na <a href="mailto:${esc(contact)}" style="color:${C.gold};text-decoration:none;">${esc(contact)}</a>` : ""}.`, { muted: true })}`,
    `Objednávka ${order.number} byla zrušena.`,
  );
  const text = `OBJEDNÁVKA ZRUŠENA\nObjednávka č. ${order.number}\n\nVaše objednávka byla zrušena.\n\n${opts.wasPaid ? refund : unpaid}\n\n${itemsText(order)}\n\nDěkujeme za váš zájem o limitovanou edici Mistři Evropy – Bělehrad 1976.${contact ? ` Kontakt: ${contact}` : ""}\n`;
  return { subject: title, html, text };
}
