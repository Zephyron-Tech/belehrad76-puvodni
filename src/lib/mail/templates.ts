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

const GOLD = "#a8823c";
const INK = "#1b1712";

function layout(settings: Settings, title: string, body: string): string {
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(title)}</title></head>
<body style="margin:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe6;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">
<tr><td style="background:${INK};padding:24px 28px;text-align:center;">
<div style="font-family:Georgia,serif;font-size:26px;letter-spacing:2px;color:#d9b46a;font-weight:bold;">MISTŘI EVROPY</div>
<div style="font-family:Georgia,serif;font-size:14px;letter-spacing:4px;color:#f4ecdc;margin-top:4px;">BĚLEHRAD 1976</div>
</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.55;">
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px;color:${INK};">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:20px 28px;background:#faf6ee;font-size:12px;color:#6b6252;line-height:1.5;">
Výtěžek edice jde na podporu Nadace fotbalových internacionálů.<br>
Prodávající: ${esc(settings.str("seller.name"))}, IČO ${esc(settings.str("seller.ico"))}, ${esc(settings.str("seller.address"))}<br>
Kontakt: ${esc(settings.str("contact.email"))}${settings.str("contact.phone") ? `, ${esc(settings.str("contact.phone"))}` : ""}<br>
Prodej alkoholu osobám mladším 18 let je zakázán.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function itemsTable(order: OrderWithItems): string {
  const rows = order.items
    .map(
      (i) => `<tr>
<td style="padding:6px 0;border-bottom:1px solid #eee;">${esc(i.name)}${i.madeToOrder ? '<br><span style="font-size:12px;color:#6b6252;">vyrábí se na objednávku</span>' : ""}</td>
<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}×</td>
<td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${formatCzk(i.unitPriceCzk * i.quantity)}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:12px 0;">
${rows}
<tr><td style="padding:6px 0;">Doprava – ${esc(DELIVERY_LABEL[order.deliveryMethod])}</td><td></td>
<td style="padding:6px 0;text-align:right;white-space:nowrap;">${order.shippingCzk ? formatCzk(order.shippingCzk) : "zdarma"}</td></tr>
<tr><td style="padding:8px 0;font-weight:bold;border-top:2px solid ${INK};">Celkem</td><td style="border-top:2px solid ${INK};"></td>
<td style="padding:8px 0;font-weight:bold;text-align:right;border-top:2px solid ${INK};white-space:nowrap;">${formatCzk(order.totalCzk)}</td></tr>
</table>`;
}

function itemsText(order: OrderWithItems): string {
  return [
    ...order.items.map((i) => `- ${i.name}: ${i.quantity}× = ${formatCzk(i.unitPriceCzk * i.quantity)}`),
    `- Doprava (${DELIVERY_LABEL[order.deliveryMethod]}): ${order.shippingCzk ? formatCzk(order.shippingCzk) : "zdarma"}`,
    `Celkem: ${formatCzk(order.totalCzk)}`,
  ].join("\n");
}

function deliveryHtml(order: OrderWithItems, settings: Settings): string {
  if (order.deliveryMethod === "PICKUP") {
    return `<p><strong>Osobní převzetí:</strong> ${esc(settings.str("pickup.address"))}<br>${esc(settings.str("pickup.note"))}</p>`;
  }
  if (order.deliveryMethod === "PACKETA") {
    return `<p><strong>Výdejní místo Zásilkovny:</strong><br>${esc(order.packetaPointName)}${order.packetaPointAddress ? `<br>${esc(order.packetaPointAddress)}` : ""}</p>`;
  }
  return `<p><strong>Doručovací adresa:</strong><br>${esc(order.firstName)} ${esc(order.lastName)}<br>${esc(order.street)}<br>${esc(formatZip(order.zip))} ${esc(order.city)}</p>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${esc(href)}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;padding:12px 22px;font-weight:bold;">${esc(label)}</a></p>`;
}

/** Doručení a dodací lhůta: box kurýrem (jen při doručení na adresu), kusovky na objednávku */
function madeToOrderNote(order: OrderWithItems, settings: Settings): string {
  const notes: string[] = [];
  if (order.deliveryMethod === "SHIPPING" && order.items.some((i) => i.type === "BOX")) notes.push(settings.str("box.delivery"));
  if (order.items.some((i) => i.madeToOrder)) notes.push(settings.str("bottle.lead_time"));
  return notes.map((n) => `<p style="font-size:14px;color:#6b6252;">${esc(n)}</p>`).join("\n");
}

/** E-mail ihned po vytvoření objednávky */
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
    payment = `<h2 style="font-family:Georgia,serif;font-size:18px;margin:24px 0 8px;">Platební údaje</h2>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;">
<tr><td style="padding:3px 16px 3px 0;color:#6b6252;">Číslo účtu</td><td><strong>${esc(t.account)}</strong></td></tr>
<tr><td style="padding:3px 16px 3px 0;color:#6b6252;">IBAN</td><td>${esc(formatIban(t.iban))}</td></tr>
<tr><td style="padding:3px 16px 3px 0;color:#6b6252;">Variabilní symbol</td><td><strong>${esc(t.variableSymbol)}</strong></td></tr>
<tr><td style="padding:3px 16px 3px 0;color:#6b6252;">Částka</td><td><strong>${formatCzk(t.amountCzk)}</strong></td></tr>
<tr><td style="padding:3px 16px 3px 0;color:#6b6252;">Zaplaťte do</td><td>${esc(formatDateTime(order.reservedUntil))}</td></tr>
</table>
${opts.qrCid ? `<p><img src="cid:${opts.qrCid}" width="180" height="180" alt="QR platba"></p>` : ""}
<p style="font-size:14px;">Po připsání platby vám pošleme potvrzení. Nezaplacená objednávka se po uplynutí lhůty automaticky zruší.</p>`;
    paymentText = `Platební údaje:\nÚčet: ${t.account}\nIBAN: ${t.iban}\nVS: ${t.variableSymbol}\nČástka: ${formatCzk(t.amountCzk)}\nZaplaťte do: ${formatDateTime(order.reservedUntil)}\n`;
  } else {
    payment = `<p>Pokud platba kartou neproběhla, můžete ji dokončit na stránce objednávky:</p>${button(opts.orderUrl, "Zobrazit objednávku")}`;
    paymentText = `Pokud platba neproběhla, dokončete ji zde: ${opts.orderUrl}\n`;
  }

  const html = layout(
    settings,
    title,
    `<p>Dobrý den, ${esc(order.firstName)},</p>
<p>děkujeme za objednávku z limitované edice Mistři Evropy – Bělehrad 1976. Objednávka čeká na zaplacení.</p>
${itemsTable(order)}
${payment}
${deliveryHtml(order, settings)}
${madeToOrderNote(order, settings)}
${order.eveningInterest ? `<p>Po zaplacení vás zařadíme do losování o vstup na slavnostní večer. <strong>${EVENING_ENTRY_NOTE}</strong></p>` : ""}
<p style="font-size:13px;color:#6b6252;">Stav objednávky: <a href="${esc(opts.orderUrl)}">${esc(opts.orderUrl)}</a></p>`,
  );

  const text = `Dobrý den, ${order.firstName},\n\nděkujeme za objednávku ${order.number}. Objednávka čeká na zaplacení.\n\n${itemsText(order)}\n\n${paymentText}${order.eveningInterest ? `\nPo zaplacení vás zařadíme do losování o vstup na slavnostní večer. ${EVENING_ENTRY_NOTE}\n` : ""}\nStav objednávky: ${opts.orderUrl}\n`;
  return { subject: title, html, text };
}

/** Potvrzení o přijetí platby (s PDF v příloze) */
export function paymentConfirmedMail(order: OrderWithItems, settings: Settings, opts: { orderUrl: string }) {
  const title = `Platba za objednávku ${order.number} přijata`;
  const html = layout(
    settings,
    title,
    `<p>Dobrý den, ${esc(order.firstName)},</p>
<p>potvrzujeme přijetí platby <strong>${formatCzk(order.totalCzk)}</strong> za objednávku <strong>${esc(order.number)}</strong>. Potvrzení o zaplacení najdete v příloze (PDF).</p>
${itemsTable(order)}
${deliveryHtml(order, settings)}
${madeToOrderNote(order, settings)}
${
  order.eveningInterest
    ? `<p>Jste zařazeni do losování o vstup na slavnostní večer ${esc(settings.str("evening.date"))}. <strong>${EVENING_ENTRY_NOTE}</strong> O výsledku vás budeme informovat.</p>`
    : ""
}
<p>O odeslání vás budeme informovat dalším e-mailem.</p>
<p>Děkujeme, že podporujete Nadaci fotbalových internacionálů.</p>`,
  );
  const text = `Dobrý den, ${order.firstName},\n\npotvrzujeme přijetí platby ${formatCzk(order.totalCzk)} za objednávku ${order.number}. Potvrzení najdete v příloze.\n\n${itemsText(order)}\n\n${order.eveningInterest ? `Jste zařazeni do losování o vstup na slavnostní večer. ${EVENING_ENTRY_NOTE}\n\n` : ""}Stav objednávky: ${opts.orderUrl}\n`;
  return { subject: title, html, text };
}

/** Upozornění provozovateli na zaplacenou objednávku */
export function ownerPaidMail(order: OrderWithItems, settings: Settings, opts: { adminUrl: string; oversold: boolean }) {
  const title = `Zaplacená objednávka ${order.number} – ${formatCzk(order.totalCzk)}`;
  const billing = [order.companyName, order.ico && `IČO ${order.ico}`, order.dic && `DIČ ${order.dic}`].filter(Boolean).join(", ");
  const html = layout(
    settings,
    title,
    `${
      opts.oversold
        ? `<p style="background:#fde8e8;border-left:4px solid #b0262c;padding:10px 12px;"><strong>Pozor:</strong> objednávka byla zaplacena přes GoPay až po vypršení rezervace a box už nebyl skladem. Vyřešte prosím ručně (vrácení peněz nebo box z rezervy).</p>`
        : ""
    }
<p><strong>${esc(order.firstName)} ${esc(order.lastName)}</strong><br>${esc(order.email)} · ${esc(order.phone)}</p>
${billing ? `<p>Fakturační údaje: ${esc(billing)}</p>` : ""}
${itemsTable(order)}
<p>Platba: ${esc(PAYMENT_LABEL[order.paymentMethod])}</p>
${deliveryHtml(order, settings)}
<p>Zájem o slavnostní večer: <strong>${order.eveningInterest ? "ANO" : "ne"}</strong></p>
${order.note ? `<p>Poznámka zákazníka: ${esc(order.note)}</p>` : ""}
${button(opts.adminUrl, "Otevřít v administraci")}`,
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
      `<p>Dobrý den, ${esc(order.firstName)},</p>
<p>vaše objednávka <strong>${esc(order.number)}</strong> je připravena k osobnímu převzetí.</p>
<p><strong>Adresa:</strong> ${esc(settings.str("pickup.address"))}<br>${esc(settings.str("pickup.note"))}</p>
<p>Při převzetí prosím prokažte věk 18+ a uveďte číslo objednávky.</p>`,
    );
    const text = `Dobrý den, ${order.firstName},\n\nobjednávka ${order.number} je připravena k převzetí.\nAdresa: ${settings.str("pickup.address")}\n${settings.str("pickup.note")}\n\nPři převzetí prokažte věk 18+.\n`;
    return { subject: title, html, text };
  }

  const title = `Objednávka ${order.number} byla odeslána`;
  const html = layout(
    settings,
    title,
    `<p>Dobrý den, ${esc(order.firstName)},</p>
<p>vaši objednávku <strong>${esc(order.number)}</strong> jsme předali dopravci.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;">
<tr><td style="padding:3px 16px 3px 0;color:#6b6252;">Dopravce</td><td><strong>${esc(order.carrier)}</strong></td></tr>
${order.trackingNumber ? `<tr><td style="padding:3px 16px 3px 0;color:#6b6252;">Číslo zásilky</td><td><strong>${esc(order.trackingNumber)}</strong></td></tr>` : ""}
</table>
${deliveryHtml(order, settings)}
${
  order.deliveryMethod === "PACKETA"
    ? "<p>Až zásilka dorazí na výdejní místo, Zásilkovna vám pošle zprávu s kódem pro vyzvednutí. Zásilka obsahuje alkohol – při vyzvednutí prokažte věk 18+ dokladem totožnosti.</p>"
    : "<p>Zásilka obsahuje alkohol – při převzetí může dopravce ověřit věk 18+.</p>"
}`,
  );
  const text = `Dobrý den, ${order.firstName},\n\nobjednávku ${order.number} jsme předali dopravci.\nDopravce: ${order.carrier}\n${order.trackingNumber ? `Číslo zásilky: ${order.trackingNumber}\n` : ""}\nStav objednávky: ${opts.orderUrl}\n`;
  return { subject: title, html, text };
}
