import type { ProductType } from "@prisma/client";
import { shippingOptions, type ShippingOptions, type ShippingRates } from "./shipping";

export type CartLineInput = { slug: string; quantity: number };

export type CatalogProduct = {
  id: number;
  slug: string;
  type: ProductType;
  name: string;
  priceCzk: number;
  stock: number | null;
  active: boolean;
  madeToOrder: boolean;
  imageUrl: string;
};

export type PricedLine = {
  productId: number;
  slug: string;
  name: string;
  type: ProductType;
  unitPriceCzk: number;
  quantity: number;
  lineTotalCzk: number;
  madeToOrder: boolean;
  imageUrl: string;
  /** Kolik kusů lze maximálně objednat (sklad / limit objednávky) */
  maxQuantity: number;
};

export type CartIssue = { slug: string; message: string };

export type PricedCart = {
  lines: PricedLine[];
  issues: CartIssue[];
  boxes: number;
  bottles: number;
  itemsTotalCzk: number;
  /** Cena dopravy podle způsobu doručení; null = pro tento košík není k dispozici */
  shipping: ShippingOptions;
  hasMadeToOrder: boolean;
};

export type CartLimits = { maxBoxes: number; maxBottles: number };

/**
 * Ocení košík podle aktuálních produktů. Neplatné položky vyřadí nebo upraví a vrátí důvod v `issues`.
 * Objednávku lze vytvořit jen z košíku bez issues.
 */
export function priceCart(
  input: CartLineInput[],
  products: CatalogProduct[],
  limits: CartLimits,
  rates: ShippingRates,
): PricedCart {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const issues: CartIssue[] = [];

  // Sloučit duplicitní řádky
  const merged = new Map<string, number>();
  for (const line of input) {
    const qty = Math.floor(Number(line.quantity));
    if (!line.slug || !Number.isFinite(qty) || qty <= 0) continue;
    merged.set(line.slug, (merged.get(line.slug) ?? 0) + qty);
  }

  const lines: PricedLine[] = [];
  let boxesLeft = limits.maxBoxes;
  let bottlesLeft = limits.maxBottles;

  for (const [slug, requested] of merged) {
    const product = bySlug.get(slug);
    if (!product || !product.active) {
      issues.push({ slug, message: "Položka už není v nabídce a byla z košíku odebrána." });
      continue;
    }

    const isBox = product.type === "BOX";
    const orderLimit = isBox ? boxesLeft : bottlesLeft;
    const stockLimit = product.stock ?? Number.POSITIVE_INFINITY;
    const maxQuantity = Math.max(0, Math.min(orderLimit, stockLimit));

    if (maxQuantity <= 0) {
      issues.push({
        slug,
        message: stockLimit <= 0 ? `${product.name}: vyprodáno.` : `${product.name}: překročen maximální počet kusů v objednávce.`,
      });
      continue;
    }

    let quantity = requested;
    if (quantity > maxQuantity) {
      quantity = maxQuantity;
      issues.push({
        slug,
        message:
          stockLimit < orderLimit
            ? `${product.name}: skladem zbývá jen ${stockLimit} ks, počet byl upraven.`
            : `${product.name}: v jedné objednávce lze objednat nejvýše ${orderLimit} ks, počet byl upraven.`,
      });
    }

    if (isBox) boxesLeft -= quantity;
    else bottlesLeft -= quantity;

    lines.push({
      productId: product.id,
      slug,
      name: product.name,
      type: product.type,
      unitPriceCzk: product.priceCzk,
      quantity,
      lineTotalCzk: product.priceCzk * quantity,
      madeToOrder: product.madeToOrder,
      imageUrl: product.imageUrl,
      maxQuantity,
    });
  }

  // Box první, pak kusovky v pořadí katalogu
  const order = new Map(products.map((p, i) => [p.slug, i]));
  lines.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));

  const boxes = lines.filter((l) => l.type === "BOX").reduce((s, l) => s + l.quantity, 0);
  const bottles = lines.filter((l) => l.type === "BOTTLE").reduce((s, l) => s + l.quantity, 0);

  return {
    lines,
    issues,
    boxes,
    bottles,
    itemsTotalCzk: lines.reduce((s, l) => s + l.lineTotalCzk, 0),
    shipping: shippingOptions({ boxes, bottles }, rates),
    hasMadeToOrder: lines.some((l) => l.madeToOrder),
  };
}
