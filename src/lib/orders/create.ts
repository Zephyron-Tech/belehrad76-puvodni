import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { priceCartFromDb } from "../catalog";
import { audit } from "../audit";
import { CheckoutError, OutOfStockError } from "../errors";
import { reserveStock } from "./stock";
import { sendOrderReceived } from "./notifications";

/** Čísla objednávek = variabilní symbol: 2600001, 2600002, … */
const ORDER_NUMBER_BASE = 2_600_000;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const checkoutSchema = z
  .object({
    lines: z
      .array(z.object({ slug: z.string().min(1).max(100), quantity: z.number().int().positive().max(1000) }))
      .min(1, "Košík je prázdný.")
      // v nabídce je 14 produktů; strop chrání validaci před obřím polem
      .max(50, "Košík obsahuje příliš mnoho položek."),
    customer: z.object({
      firstName: z.string().trim().min(1, "Vyplňte jméno.").max(80),
      lastName: z.string().trim().min(1, "Vyplňte příjmení.").max(80),
      email: z.string().trim().toLowerCase().email("Zadejte platný e-mail.").max(160),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 ]{9,20}$/, "Zadejte platné telefonní číslo."),
    }),
    deliveryMethod: z.enum(["SHIPPING", "PICKUP"]),
    address: z
      .object({
        street: z.string().trim().max(120).optional(),
        city: z.string().trim().max(80).optional(),
        zip: z.string().trim().max(10).optional(),
      })
      .optional(),
    billing: z
      .object({
        companyName: optionalText(120),
        ico: optionalText(12),
        dic: optionalText(14),
      })
      .optional(),
    note: optionalText(1000),
    paymentMethod: z.enum(["GOPAY", "BANK_TRANSFER"]),
    eveningInterest: z.boolean().default(false),
    consents: z.object({
      terms: z.literal(true, { errorMap: () => ({ message: "Je nutný souhlas s obchodními podmínkami." }) }),
      age: z.literal(true, { errorMap: () => ({ message: "Prodej je možný jen osobám starším 18 let." }) }),
      privacy: z.literal(true, { errorMap: () => ({ message: "Je nutné potvrdit seznámení se zásadami ochrany osobních údajů." }) }),
      marketing: z.boolean().default(false),
    }),
    tracking: z
      .object({
        consent: z.boolean().default(false),
        fbp: optionalText(200),
        fbc: optionalText(300),
      })
      .optional(),
    turnstileToken: z.string().max(4096).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === "SHIPPING") {
      const a = data.address ?? {};
      if (!a.street) ctx.addIssue({ code: "custom", path: ["address", "street"], message: "Vyplňte ulici a číslo." });
      if (!a.city) ctx.addIssue({ code: "custom", path: ["address", "city"], message: "Vyplňte město." });
      if (!a.zip || !/^\d{3}\s?\d{2}$/.test(a.zip))
        ctx.addIssue({ code: "custom", path: ["address", "zip"], message: "Zadejte PSČ ve tvaru 123 45." });
    }
    const ico = data.billing?.ico;
    if (ico && !/^\d{8}$/.test(ico)) ctx.addIssue({ code: "custom", path: ["billing", "ico"], message: "IČO má 8 číslic." });
    const dic = data.billing?.dic;
    if (dic && !/^[A-Z]{2}\d{8,10}$/i.test(dic))
      ctx.addIssue({ code: "custom", path: ["billing", "dic"], message: "DIČ zadejte ve tvaru CZ12345678." });
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;

export { CheckoutError };

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Jak daleko do minulosti se počítají nezaplacené objednávky z jedné IP (nejdelší rezervace převodem). */
const HOARDING_WINDOW_MS = 14 * 24 * 3_600_000;

/**
 * Ochrana skladu boxů: nezaplacená objednávka box drží (převodem i několik dní). Bez limitu by šlo
 * z jedné adresy opakovanými objednávkami zablokovat celý sklad. Z jedné IP proto smí na zaplacení
 * čekat nejvýš tolik boxů, kolik jde koupit v jedné objednávce. Počítá se z databáze (audit log),
 * takže limit platí i při více instancích aplikace.
 */
async function assertNoReservationHoarding(
  ip: string | null,
  lines: { type: string; quantity: number }[],
  maxBoxes: number,
) {
  const newBoxes = lines.filter((l) => l.type === "BOX").reduce((s, l) => s + l.quantity, 0);
  if (!ip || newBoxes === 0) return;
  const created = await prisma.auditLog.findMany({
    where: { action: "order_created", ip, createdAt: { gte: new Date(Date.now() - HOARDING_WINDOW_MS) } },
    select: { orderId: true },
  });
  const orderIds = created.map((a) => a.orderId).filter((id): id is number => id !== null);
  if (orderIds.length === 0) return;
  const pending = await prisma.orderItem.aggregate({
    _sum: { quantity: true },
    where: { type: "BOX", order: { id: { in: orderIds }, status: "PENDING" } },
  });
  if ((pending._sum.quantity ?? 0) + newBoxes > maxBoxes) {
    throw new CheckoutError(
      "Z vašeho připojení už čekají na zaplacení jiné objednávky boxů. Dokončete prosím jejich platbu, nebo počkejte, až vyprší.",
    );
  }
}

/**
 * Vytvoří objednávku, zarezervuje boxy a pošle e-mail „objednávka přijata“.
 * Rezervace platí po dobu platby (GoPay) nebo několik dní (převod), pak se objednávka zruší.
 */
export async function createOrder(raw: unknown, ip: string | null) {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CheckoutError("Zkontrolujte prosím vyplněné údaje.", zodFieldErrors(parsed.error));
  }
  const input = parsed.data;

  const { cart, settings } = await priceCartFromDb(input.lines);

  if (!settings.bool("sales.open")) throw new CheckoutError("Prodej momentálně není spuštěn.");
  if (cart.issues.length > 0) throw new CheckoutError(cart.issues.map((i) => i.message).join(" "));
  if (cart.lines.length === 0) throw new CheckoutError("Košík je prázdný.");
  if (input.deliveryMethod === "PICKUP" && !settings.bool("pickup.enabled")) {
    throw new CheckoutError("Osobní převzetí momentálně není k dispozici.");
  }

  await assertNoReservationHoarding(ip, cart.lines, settings.num("order.max_boxes"));

  const shippingCzk = cart.shipping[input.deliveryMethod];
  const reservationMs =
    input.paymentMethod === "GOPAY"
      ? settings.num("reservation.gopay_minutes") * 60_000
      : settings.num("reservation.transfer_days") * 24 * 3_600_000;

  const isShipping = input.deliveryMethod === "SHIPPING";

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: `tmp-${crypto.randomUUID()}`,
          publicToken: crypto.randomBytes(24).toString("base64url"),
          paymentMethod: input.paymentMethod,
          deliveryMethod: input.deliveryMethod,
          itemsTotalCzk: cart.itemsTotalCzk,
          shippingCzk,
          totalCzk: cart.itemsTotalCzk + shippingCzk,
          firstName: input.customer.firstName,
          lastName: input.customer.lastName,
          email: input.customer.email,
          phone: input.customer.phone.replace(/\s+/g, " "),
          street: isShipping ? input.address?.street : null,
          city: isShipping ? input.address?.city : null,
          zip: isShipping ? input.address?.zip?.replace(/\s/g, "") : null,
          companyName: input.billing?.companyName,
          ico: input.billing?.ico,
          dic: input.billing?.dic?.toUpperCase(),
          note: input.note,
          // Losování o vstup jen u objednávky s boxem (1 vstup na 1 box)
          eveningInterest: input.eveningInterest && cart.lines.some((l) => l.type === "BOX"),
          marketingConsent: input.consents.marketing,
          consentsAt: new Date(),
          trackingConsent: input.tracking?.consent ?? false,
          fbp: input.tracking?.consent ? input.tracking.fbp : null,
          fbc: input.tracking?.consent ? input.tracking.fbc : null,
          reservedUntil: new Date(Date.now() + reservationMs),
          items: {
            create: cart.lines.map((l) => ({
              productId: l.productId,
              name: l.name,
              type: l.type,
              unitPriceCzk: l.unitPriceCzk,
              quantity: l.quantity,
              madeToOrder: l.madeToOrder,
            })),
          },
        },
      });

      const reserved = await reserveStock(
        tx,
        cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, name: l.name })),
      );

      const updated = await tx.order.update({
        where: { id: created.id },
        data: { number: String(ORDER_NUMBER_BASE + created.id), stockReserved: reserved },
        include: { items: true },
      });

      await audit(
        { action: "order_created", orderId: updated.id, toStatus: "PENDING", detail: input.paymentMethod },
        { source: "customer", ip },
        tx,
      );
      return updated;
    });
  } catch (err) {
    if (err instanceof OutOfStockError) {
      throw new CheckoutError(`${err.productName}: mezitím došly zásoby. Upravte prosím košík.`);
    }
    throw err;
  }

  await sendOrderReceived(order.id).catch((err) => console.error("[mail] order received failed", err));

  return order;
}
