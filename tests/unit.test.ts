import { describe, expect, it } from "vitest";
import { packetaQuote, shippingOptions } from "@/lib/shipping";
import { shippingRates } from "@/lib/catalog";
import { buildSpd, czechAccountToIban, isValidIban } from "@/lib/bank";
import { priceCart, type CatalogProduct } from "@/lib/cart";
import { toCsv } from "@/lib/csv";
import { Settings } from "@/lib/settings";
import { typo } from "@/lib/format";

// Výchozí sazby z default-settings (ceník Zásilkovny od 1. 11. 2026)
const rates = shippingRates(new Settings({}));

describe("doprava", () => {
  it("box: jen kurýr na adresu, 490 Kč jednou, i při více boxech a kusovkách", () => {
    expect(shippingOptions({ boxes: 1, bottles: 0 }, rates)).toEqual({ SHIPPING: 490, PACKETA: null, PICKUP: 0 });
    expect(shippingOptions({ boxes: 3, bottles: 5 }, rates)).toEqual({ SHIPPING: 490, PACKETA: null, PICKUP: 0 });
  });
  it("jen kusovky: jen Zásilkovna na výdejní místo, osobní převzetí zdarma", () => {
    expect(shippingOptions({ boxes: 0, bottles: 1 }, rates)).toEqual({ SHIPPING: null, PACKETA: 138, PICKUP: 0 });
  });
  it("kusovky dražší než kurýr: jen kurýr na adresu za 490 Kč", () => {
    expect(shippingOptions({ boxes: 0, bottles: 26 }, rates).PACKETA).toBe(477);
    expect(shippingOptions({ boxes: 0, bottles: 27 }, rates)).toEqual({ SHIPPING: 490, PACKETA: null, PICKUP: 0 });
  });
});

describe("Zásilkovna – výdejní místo / Z-BOX", () => {
  it("1 lahev: 1,5 kg standardní zásilka = (72 + 19,5 % palivo + 2 × 1,10 mýto + 25 ověření věku) × 1,21", () => {
    const q = packetaQuote(1, rates.packeta);
    expect(q.parcels).toHaveLength(1);
    expect(q.parcels[0]).toMatchObject({ weightKg: 1.5, size: "standard", baseCzk: 72, fuelCzk: 14.04, tollCzk: 2.2, ageCheckCzk: 25 });
    expect(q.netCzk).toBe(113.24);
    expect(q.grossCzk).toBe(138);
  });
  it("3 lahve: jedna standardní zásilka 3,7 kg", () => {
    const q = packetaQuote(3, rates.packeta);
    expect(q.parcels).toHaveLength(1);
    expect(q.parcels[0]).toMatchObject({ weightKg: 3.7, size: "standard", tollCzk: 4.4 });
    expect(q.grossCzk).toBe(140);
  });
  it("5 lahví: přes 5 kg → nadrozměrná zásilka", () => {
    const q = packetaQuote(5, rates.packeta);
    expect(q.parcels[0]).toMatchObject({ weightKg: 5.9, size: "oversize", baseCzk: 130 });
    expect(q.grossCzk).toBe(227);
  });
  it("14 lahví: plná zásilka (13 lahví, 14,7 kg) + 1 lahev zvlášť", () => {
    const q = packetaQuote(14, rates.packeta);
    expect(q.parcels.map((p) => p.bottles)).toEqual([13, 1]);
    expect(q.parcels[0].weightKg).toBe(14.7);
  });
});

describe("bankovní účet a QR platba", () => {
  it("převod čísla účtu na IBAN (vzor ČNB)", () => {
    expect(czechAccountToIban("19-2000145399/0800")).toBe("CZ6508000000192000145399");
  });
  it("účet e-shopu 303642799/0300 má platný IBAN", () => {
    const iban = czechAccountToIban("303642799/0300");
    expect(iban).toMatch(/^CZ\d{2}03000000000303642799$/);
    expect(isValidIban(iban)).toBe(true);
  });
  it("SPD řetězec obsahuje účet, částku a VS", () => {
    const spd = buildSpd({
      iban: "CZ6508000000192000145399",
      amountCzk: 10370,
      variableSymbol: "2600001",
      message: "Objednávka 2600001",
    });
    expect(spd).toBe("SPD*1.0*ACC:CZ6508000000192000145399*AM:10370.00*CC:CZK*X-VS:2600001*MSG:OBJEDNAVKA 2600001");
  });
});

describe("košík", () => {
  const products: CatalogProduct[] = [
    { id: 1, slug: "box", type: "BOX", name: "Box", priceCzk: 9880, stock: 2, active: true, madeToOrder: false, imageUrl: "" },
    { id: 2, slug: "panenka", type: "BOTTLE", name: "Panenka", priceCzk: 760, stock: null, active: true, madeToOrder: true, imageUrl: "" },
    { id: 3, slug: "stara", type: "BOTTLE", name: "Stará", priceCzk: 760, stock: null, active: false, madeToOrder: true, imageUrl: "" },
  ];
  const limits = { maxBoxes: 10, maxBottles: 50 };

  it("oceňuje box + kusovky a dopravu", () => {
    const cart = priceCart(
      [
        { slug: "box", quantity: 1 },
        { slug: "panenka", quantity: 2 },
      ],
      products,
      limits,
      rates,
    );
    expect(cart.issues).toEqual([]);
    expect(cart.itemsTotalCzk).toBe(9880 + 1520);
    expect(cart.shipping).toEqual({ SHIPPING: 490, PACKETA: null, PICKUP: 0 });
    expect(cart.hasMadeToOrder).toBe(true);
  });

  it("kusovky mají neomezený sklad", () => {
    const cart = priceCart([{ slug: "panenka", quantity: 40 }], products, limits, rates);
    expect(cart.issues).toEqual([]);
    expect(cart.bottles).toBe(40);
  });

  it("box nelze objednat nad stav skladu", () => {
    const cart = priceCart([{ slug: "box", quantity: 5 }], products, limits, rates);
    expect(cart.boxes).toBe(2);
    expect(cart.issues[0].message).toContain("zbývá jen 2");
  });

  it("vyprodaný box se z košíku vyřadí", () => {
    const sold = products.map((p) => (p.slug === "box" ? { ...p, stock: 0 } : p));
    const cart = priceCart([{ slug: "box", quantity: 1 }], sold, limits, rates);
    expect(cart.lines).toHaveLength(0);
    expect(cart.issues[0].message).toContain("vyprodáno");
  });

  it("neaktivní a neznámé položky se vyřadí", () => {
    const cart = priceCart(
      [
        { slug: "stara", quantity: 1 },
        { slug: "neexistuje", quantity: 1 },
      ],
      products,
      limits,
      rates,
    );
    expect(cart.lines).toHaveLength(0);
    expect(cart.issues).toHaveLength(2);
  });

  it("slučuje duplicitní řádky a hlídá limit objednávky", () => {
    const cart = priceCart(
      [
        { slug: "panenka", quantity: 30 },
        { slug: "panenka", quantity: 30 },
      ],
      products,
      limits,
      rates,
    );
    expect(cart.lines).toHaveLength(1);
    expect(cart.bottles).toBe(50);
    expect(cart.issues).toHaveLength(1);
  });
});

describe("CSV", () => {
  it("středník, BOM, uvozovky a ochrana proti CSV injection", () => {
    const csv = toCsv([
      ["a", "b;c", 'd"e'],
      ["=SUM(A1)", 5, null],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('a;"b;c";"d""e"\r\n');
    expect(csv).toContain("'=SUM(A1);5;\r\n");
  });
});

describe("nastavení", () => {
  it("dosazuje hodnoty do textů a má výchozí hodnoty", () => {
    const s = new Settings({ "seller.name": "Firma s.r.o." });
    expect(s.interpolate("Prodává {{seller.name}}, IČO {{ seller.ico }}.")).toBe("Prodává Firma s.r.o., IČO 10788433.");
    expect(s.num("shipping.box_czk")).toBe(490);
    expect(s.bool("pickup.enabled")).toBe(true);
  });
});

describe("česká typografie", () => {
  const NBSP = "\u00a0";
  it("nezlomitelná mezera za jednopísmennými předložkami a spojkami", () => {
    expect(typo("a v Praze k dispozici i s boxem")).toBe(`a${NBSP}v${NBSP}Praze k${NBSP}dispozici i${NBSP}s${NBSP}boxem`);
  });
  it("číslo a jednotka zůstanou u sebe", () => {
    expect(typo("slivovice 50 %, lhůta 8 dní.")).toBe(`slivovice 50${NBSP}%, lhůta 8${NBSP}dní.`);
  });
  it("odkazy a slova s více písmeny nemění", () => {
    expect(typo("[řád](/reklamacni-rad) Box")).toBe("[řád](/reklamacni-rad) Box");
  });
});

