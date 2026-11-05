import { prisma } from "./db";
import { toCsv } from "./csv";
import { formatDateTime } from "./format";
import { DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL } from "./labels";

const PAID_STATUSES = ["PAID", "SHIPPED", "COMPLETED"] as const;

/** CSV všech objednávek pro účetnictví. */
export async function ordersCsv(filter: { from?: Date; to?: Date; onlyPaid?: boolean } = {}) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: filter.from, lte: filter.to },
      ...(filter.onlyPaid ? { status: { in: [...PAID_STATUSES] } } : {}),
    },
    include: { items: true },
    orderBy: { id: "asc" },
  });

  const rows: (string | number | null)[][] = [
    [
      "Číslo (VS)",
      "Vytvořeno",
      "Stav",
      "Zaplaceno",
      "Způsob platby",
      "Doprava",
      "Položky",
      "Boxy ks",
      "Kusovky ks",
      "Zboží Kč",
      "Doprava Kč",
      "Celkem Kč",
      "Jméno",
      "Příjmení",
      "E-mail",
      "Telefon",
      "Ulice",
      "Město",
      "PSČ",
      "Výdejní místo Zásilkovny",
      "Firma",
      "IČO",
      "DIČ",
      "Dopravce",
      "Číslo zásilky",
      "Odesláno",
    ],
  ];
  for (const o of orders) {
    rows.push([
      o.number,
      formatDateTime(o.createdAt),
      STATUS_LABEL[o.status],
      formatDateTime(o.paidAt),
      PAYMENT_LABEL[o.paymentMethod],
      DELIVERY_LABEL[o.deliveryMethod],
      o.items.map((i) => `${i.quantity}× ${i.name}`).join(", "),
      o.items.filter((i) => i.type === "BOX").reduce((s, i) => s + i.quantity, 0),
      o.items.filter((i) => i.type === "BOTTLE").reduce((s, i) => s + i.quantity, 0),
      o.itemsTotalCzk,
      o.shippingCzk,
      o.totalCzk,
      o.firstName,
      o.lastName,
      o.email,
      o.phone,
      o.street,
      o.city,
      o.zip,
      o.packetaPointName ? `${o.packetaPointName}${o.packetaPointAddress ? `, ${o.packetaPointAddress}` : ""} (ID ${o.packetaPointId})` : null,
      o.companyName,
      o.ico,
      o.dic,
      o.carrier,
      o.trackingNumber,
      formatDateTime(o.shippedAt),
    ]);
  }
  return { csv: toCsv(rows), count: orders.length };
}

/** CSV zájemců o slavnostní večer: jen zaplacené objednávky se zájmem o účast. */
export async function eveningCsv() {
  const orders = await prisma.order.findMany({
    where: { eveningInterest: true, status: { in: [...PAID_STATUSES] }, anonymizedAt: null },
    include: { items: true },
    orderBy: { paidAt: "asc" },
  });
  const rows: (string | number | null)[][] = [
    ["Číslo objednávky", "Zaplaceno", "Jméno", "Příjmení", "E-mail", "Telefon", "Boxy ks (= počet vstupů)", "Kusovky ks"],
  ];
  for (const o of orders) {
    rows.push([
      o.number,
      formatDateTime(o.paidAt),
      o.firstName,
      o.lastName,
      o.email,
      o.phone,
      o.items.filter((i) => i.type === "BOX").reduce((s, i) => s + i.quantity, 0),
      o.items.filter((i) => i.type === "BOTTLE").reduce((s, i) => s + i.quantity, 0),
    ]);
  }
  return { csv: toCsv(rows), count: orders.length };
}
