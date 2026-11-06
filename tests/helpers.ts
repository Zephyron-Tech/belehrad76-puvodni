import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/config/default-settings";
import { invalidateSettingsCache } from "@/lib/settings";
import { sentMailLog } from "@/lib/mail/transport";
import type { CheckoutInput } from "@/lib/orders/create";

/** Vyčistí DB a naplní minimální katalog: box (sklad dle parametru) + 2 kusovky. */
export async function resetDb(boxStock = 144) {
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.adminUser.deleteMany();

  await prisma.setting.createMany({ data: DEFAULT_SETTINGS });
  // Převod / QR je v provozu vypnutý, testy ho ale dál pokrývají (kód zůstává pro případné zapnutí)
  await prisma.setting.update({ where: { key: "payment.bank_transfer" }, data: { value: "true" } });
  await prisma.product.createMany({
    data: [
      { slug: "box", type: "BOX", name: "Box Mistři Evropy", priceCzk: 9880, stock: boxStock, imageUrl: "/img/box.jpg", sortOrder: 0 },
      { slug: "panenka", type: "BOTTLE", name: "Slivovice Antonín Panenka", priceCzk: 760, stock: null, madeToOrder: true, imageUrl: "/x.jpg", sortOrder: 1 },
      { slug: "viktor", type: "BOTTLE", name: "Slivovice Ivo Viktor", priceCzk: 760, stock: null, madeToOrder: true, imageUrl: "/y.jpg", sortOrder: 2 },
    ],
  });
  invalidateSettingsCache();
  sentMailLog.length = 0;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  invalidateSettingsCache();
}

export async function boxStock() {
  return (await prisma.product.findUniqueOrThrow({ where: { slug: "box" } })).stock;
}

export function checkout(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    lines: [{ slug: "box", quantity: 1 }],
    customer: { firstName: "Jan", lastName: "Novák", email: "jan@example.com", phone: "+420 777 123 456" },
    deliveryMethod: "SHIPPING",
    address: { street: "Dlouhá 1", city: "Praha", zip: "110 00" },
    paymentMethod: "BANK_TRANSFER",
    eveningInterest: false,
    consents: { terms: true, age: true, privacy: true, marketing: false },
    ...overrides,
  };
}

/** Objednávka jen kusovek: doprava Zásilkovnou na výdejní místo. */
export function bottlesCheckout(lines: CheckoutInput["lines"], overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return checkout({
    lines,
    deliveryMethod: "PACKETA",
    address: undefined,
    packetaPoint: { id: "12345", name: "Praha 6, Dejvická 1 (Trafika)", address: "Dejvická 1, 160 00 Praha" },
    ...overrides,
  });
}
