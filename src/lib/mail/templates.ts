import type { Order, OrderItem } from "@prisma/client";
import type { Settings } from "../settings";
import { formatCzk, formatDateTime, formatZip } from "../format";
import { DELIVERY_LABEL, EVENING_ENTRY_NOTE, PAYMENT_LABEL } from "../labels";
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
  const title = `Objednávka ${order.number} přijata`;
  let payment = "";
  let paymentText = "";

  if (order.paymentMethod === "BANK_TRANSFER" && opts.transfer) {
    const t = opts.transfer;
    const qr = opts.qrCid
      ? `<td style="width:164px;padding-left:24px;vertical-align:top;" align="right">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px;"><img src="cid:${opts.qrCid}" width="140" height="140" alt="QR platba" style="display:block;"></td></tr></table>
<div style="font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-top:8px;text-align:center;">QR platba</div>
</td>`
      : "";
    payment = `${sectionTitle("Platební údaje")}
<tr><td style="padding:4px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:top;">${rows(
      [
        ["Číslo účtu", `<strong>${esc(t.account)}</strong>`],
        ["IBAN", esc(formatIban(t.iban))],
        ["Variabilní symbol", `<strong>${esc(t.variableSymbol)}</strong>`],
        ["Splatnost", esc(formatDateTime(order.reservedUntil))],
        ["K úhradě", formatCzk(t.amountCzk)],
      ],
      { strongLast: true },
    )}</td>
${qr}
</tr></table>
</td></tr>
${para("Nezaplacená objednávka se po splatnosti automaticky zruší. Po připsání platby obdržíte potvrzení.", { muted: true })}`;
    paymentText = `PLATEBNÍ ÚDAJE\nČíslo účtu: ${t.account}\nIBAN: ${t.iban}\nVariabilní symbol: ${t.variableSymbol}\nSplatnost: ${formatDateTime(order.reservedUntil)}\nK úhradě: ${formatCzk(t.amountCzk)}\n`;
  } else {
    payment = `${para("Pokud platba kartou neproběhla, dokončíte ji na stránce objednávky.", { muted: true, center: true })}
${button(opts.orderUrl, "Dokončit platbu")}`;
    paymentText = `Pokud platba neproběhla, dokončete ji zde: ${opts.orderUrl}\n`;
  }

  const html = layout(
    settings,
    title,
    `${statusBlock("pending", "Objednávka přijata", "Čeká na úhradu")}
${para(`Objednávka č. <span style="color:${C.goldLight};">${esc(order.number)}</span> · ${esc(formatDateTime(order.createdAt))}`, { muted: true, center: true })}
${sectionTitle("Objednávka")}
${itemsTable(order)}
${payment}
${deliveryBlock(order, settings)}
${notesBlock(order, settings)}
${order.eveningInterest ? para(`Po zaplacení budete zařazeni do losování o vstup na slavnostní večer. ${esc(EVENING_ENTRY_NOTE)}`, { muted: true }) : ""}
${order.paymentMethod === "BANK_TRANSFER" ? button(opts.orderUrl, "Stav objednávky") : ""}`,
    `Čeká na úhradu ${formatCzk(order.totalCzk)}.`,
  );

  const text = `OBJEDNÁVKA PŘIJATA – ČEKÁ NA ÚHRADU\nObjednávka č. ${order.number}\n\n${itemsText(order)}\n\n${paymentText}${order.eveningInterest ? `\nPo zaplacení budete zařazeni do losování o vstup na slavnostní večer. ${EVENING_ENTRY_NOTE}\n` : ""}\nStav objednávky: ${opts.orderUrl}\n`;
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
${para("Potvrzení o zaplacení je v příloze (PDF). Nejedná se o daňový doklad.", { muted: true })}
${sectionTitle("Předmět platby")}
${itemsTable(order)}
${deliveryBlock(order, settings)}
${notesBlock(order, settings)}
${
  order.eveningInterest
    ? para(
        `Jste zařazeni do losování o vstup na slavnostní večer ${esc(settings.str("evening.date"))}. ${esc(EVENING_ENTRY_NOTE)} O výsledku vás budeme informovat.`,
        { muted: true },
      )
    : ""
}
${para("O odeslání vás budeme informovat dalším e-mailem.", { muted: true })}
${button(opts.orderUrl, "Stav objednávky")}`,
    `Přijato ${formatCzk(order.totalCzk)} za objednávku ${order.number}.`,
  );

  const text = `POTVRZENÍ O PŘIJETÍ PLATBY\n\nČíslo objednávky: ${order.number}\nVariabilní symbol: ${order.number}\nDatum přijetí platby: ${paidAt}\nZpůsob platby: ${PAYMENT_LABEL[order.paymentMethod]}\nPřijatá částka: ${formatCzk(order.totalCzk)}\n\nPotvrzení o zaplacení je v příloze (PDF). Nejedná se o daňový doklad.\n\n${itemsText(order)}\n\n${order.eveningInterest ? `Jste zařazeni do losování o vstup na slavnostní večer. ${EVENING_ENTRY_NOTE}\n\n` : ""}Stav objednávky: ${opts.orderUrl}\n`;
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
${deliveryBlock(order, settings)}
${para("Při převzetí uveďte číslo objednávky a prokažte věk 18+ dokladem totožnosti.", { muted: true })}`,
      `Objednávka ${order.number} čeká na převzetí.`,
    );
    const text = `PŘIPRAVENO K PŘEVZETÍ\nObjednávka č. ${order.number}\n\nAdresa: ${settings.str("pickup.address")}\n${settings.str("pickup.note")}\n\nPři převzetí uveďte číslo objednávky a prokažte věk 18+.\n`;
    return { subject: title, html, text };
  }

  const title = `Objednávka ${order.number} byla odeslána`;
  const shipment: [string, string][] = [["Dopravce", esc(order.carrier)]];
  if (order.trackingNumber) shipment.push(["Číslo zásilky", `<strong>${esc(order.trackingNumber)}</strong>`]);

  const html = layout(
    settings,
    title,
    `${statusBlock("neutral", "Odesláno", `Objednávka č. ${order.number}`)}
${sectionTitle("Zásilka")}
<tr><td style="padding:4px 40px 0;">${rows(shipment)}</td></tr>
${deliveryBlock(order, settings)}
${para(
  order.deliveryMethod === "PACKETA"
    ? "Jakmile zásilka dorazí na výdejní místo, Zásilkovna vám pošle kód pro vyzvednutí. Zásilka obsahuje alkohol – při vyzvednutí prokažte věk 18+ dokladem totožnosti."
    : "Zásilka obsahuje alkohol – při převzetí může dopravce ověřit věk 18+.",
  { muted: true },
)}
${button(opts.orderUrl, "Stav objednávky")}`,
    `Objednávka ${order.number} je na cestě.`,
  );
  const text = `ODESLÁNO\nObjednávka č. ${order.number}\n\nDopravce: ${order.carrier}\n${order.trackingNumber ? `Číslo zásilky: ${order.trackingNumber}\n` : ""}\nStav objednávky: ${opts.orderUrl}\n`;
  return { subject: title, html, text };
}
