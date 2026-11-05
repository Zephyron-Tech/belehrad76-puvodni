/** SHIPPING = kurýr na adresu, PACKETA = Zásilkovna na výdejní místo, PICKUP = osobní převzetí na FAČR */
export type DeliveryMethodValue = "SHIPPING" | "PACKETA" | "PICKUP";

/**
 * Parametry Zásilkovny pro kusovky – doručení na výdejní místo s obsluhou (Z-BOX neumí ověření věku 18+)
 * (Kompletní ceník služeb Zásilkovny, platnost od 1. 11. 2026, ceny bez DPH).
 * Cena v rámci ČR nezávisí na vzdálenosti – jen na hmotnosti a rozměrech zásilky.
 */
export type PacketaRates = {
  /** Standardní zásilka do 5 kg (max. 60 cm jedna strana, součet stran 120 cm), Kč bez DPH */
  standardCzk: number;
  /** Nadrozměrná zásilka 5–15 kg, Kč bez DPH */
  oversizeCzk: number;
  /** Hranice standardní zásilky (kg) */
  standardMaxKg: number;
  /** Maximální hmotnost jedné zásilky (kg); těžší objednávka se rozdělí do více zásilek */
  parcelMaxKg: number;
  /** Palivový příplatek v % z ceny přepravy */
  fuelPct: number;
  /** Mýtný příplatek za každý započatý kg, Kč bez DPH */
  tollPerKgCzk: number;
  /** Ověření věku 18+ při předání, za zásilku, Kč bez DPH */
  ageCheckCzk: number;
  /** Hmotnost jedné lahve (kg) */
  bottleKg: number;
  /** Obal: krabice na zásilku (kg) */
  packageKg: number;
  /** Obal: ochranná vložka na každou lahev (kg) */
  paddingPerBottleKg: number;
  /** DPH v % */
  vatPct: number;
};

export type ShippingRates = {
  /** Doprava za objednávku s boxem – jednou, bez ohledu na počet boxů a kusovek (Kč). Zároveň cena osobního kurýra. */
  boxCzk: number;
  /** Výpočet ceny Zásilkovny pro objednávky jen s kusovkami */
  packeta: PacketaRates;
};

export type PacketaParcel = {
  bottles: number;
  weightKg: number;
  /** "standard" do 5 kg, "oversize" 5–15 kg */
  size: "standard" | "oversize";
  baseCzk: number;
  fuelCzk: number;
  tollCzk: number;
  ageCheckCzk: number;
  /** Součet bez DPH */
  netCzk: number;
};

export type PacketaQuote = {
  parcels: PacketaParcel[];
  netCzk: number;
  /** Cena s DPH zaokrouhlená nahoru na celé Kč */
  grossCzk: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Kolik lahví se vejde do jedné zásilky (podle maximální hmotnosti). */
export function bottlesPerParcel(r: PacketaRates): number {
  return Math.max(1, Math.floor((r.parcelMaxKg - r.packageKg) / (r.bottleKg + r.paddingPerBottleKg)));
}

/**
 * Cena jedné zásilky Zásilkovny s n lahvemi:
 *   hmotnost = n × (lahev + vložka) + krabice
 *   základ   = standardní (do 5 kg) / nadrozměrná (5–15 kg) cena
 *   palivo   = základ × palivový příplatek %
 *   mýto     = započaté kg × sazba
 *   + ověření věku 18+
 */
export function packetaParcel(bottles: number, r: PacketaRates): PacketaParcel {
  const weightKg = round2(bottles * (r.bottleKg + r.paddingPerBottleKg) + r.packageKg);
  const size = weightKg <= r.standardMaxKg ? "standard" : "oversize";
  const baseCzk = size === "standard" ? r.standardCzk : r.oversizeCzk;
  const fuelCzk = round2((baseCzk * r.fuelPct) / 100);
  const tollCzk = round2(Math.ceil(weightKg) * r.tollPerKgCzk);
  const netCzk = round2(baseCzk + fuelCzk + tollCzk + r.ageCheckCzk);
  return { bottles, weightKg, size, baseCzk, fuelCzk, tollCzk, ageCheckCzk: r.ageCheckCzk, netCzk };
}

/**
 * Cena Zásilkovny za n kusovek. Lahve se balí do co nejméně zásilek (plné zásilky + zbytek),
 * protože jedna nadrozměrná zásilka je levnější než dvě standardní.
 */
export function packetaQuote(bottles: number, r: PacketaRates): PacketaQuote {
  const parcels: PacketaParcel[] = [];
  const perParcel = bottlesPerParcel(r);
  for (let left = bottles; left > 0; left -= perParcel) parcels.push(packetaParcel(Math.min(left, perParcel), r));
  const netCzk = round2(parcels.reduce((sum, p) => sum + p.netCzk, 0));
  // drobná tolerance proti chybám desetinných čísel (např. 176,0000001 → 176)
  const grossCzk = Math.ceil(round2((netCzk * (100 + r.vatPct)) / 100) - 1e-9);
  return { parcels, netCzk, grossCzk };
}

/** Cena dopravy podle způsobu doručení; null = pro tento košík není k dispozici. */
export type ShippingOptions = Record<DeliveryMethodValue, number | null>;

/**
 * Způsoby doručení a jejich cena podle obsahu košíku:
 *  - osobní převzetí na FAČR zdarma (vždy),
 *  - košík s boxem: jen kurýr na adresu, jednou 490 Kč (i při více boxech a přidaných kusovkách),
 *  - jen kusovky: jen Zásilkovna na výdejní místo podle ceníku;
 *    když by Zásilkovna vyšla dráž než kurýr (490 Kč), jen kurýr na adresu za 490 Kč.
 */
export function shippingOptions(quantities: { boxes: number; bottles: number }, rates: ShippingRates): ShippingOptions {
  const none = { SHIPPING: null, PACKETA: null, PICKUP: 0 };
  if (quantities.boxes > 0) return { ...none, SHIPPING: rates.boxCzk };
  if (quantities.bottles <= 0) return none;
  const packeta = packetaQuote(quantities.bottles, rates.packeta).grossCzk;
  return packeta > rates.boxCzk ? { ...none, SHIPPING: rates.boxCzk } : { ...none, PACKETA: packeta };
}

/** Nejnižší cena dopravy kusovky (1 lahev do výdejního místa) – pro texty na webu („od … Kč“). */
export function bottleShippingFromCzk(rates: ShippingRates): number {
  return packetaQuote(1, rates.packeta).grossCzk;
}
