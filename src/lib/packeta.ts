/**
 * Zásilkovna (Packeta) – zakládání zásilek a tisk štítků přes API.
 * Dokumentace: https://docs.packetery.com (REST/XML API: createPacket, packetsLabelsPdf)
 *
 * Zásilky se zakládají ručně tlačítkem v administraci u zaplacené objednávky s doručením na výdejní místo.
 * Objednávka těžší než jedna zásilka (víc než 13 lahví) se rozdělí na víc zásilek – stejně jako ve výpočtu dopravy.
 */
import type { Order, OrderItem } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { audit, type ActionContext } from "./audit";
import { getSettings, type Settings } from "./settings";
import { shippingRates } from "./catalog";
import { packetaQuote } from "./shipping";
import { AppError } from "./errors";

export class PacketaError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "PacketaError";
  }
}

const esc = (v: string | number) =>
  String(v).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const unesc = (v: string) =>
  v.replace(/&(lt|gt|amp|apos|quot);/g, (_, e: string) => ({ lt: "<", gt: ">", amp: "&", apos: "'", quot: '"' })[e]!);

/** Jednoduchý převod objektu na XML (jen to, co API Zásilkovny potřebuje). */
function toXml(name: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return `<${name}>${value.map((v) => toXml("id", v)).join("")}</${name}>`;
  if (typeof value === "object") {
    return `<${name}>${Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => toXml(k, v))
      .join("")}</${name}>`;
  }
  return `<${name}>${esc(value as string | number)}</${name}>`;
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? unesc(m[1].trim()) : null;
};

/** Zavolá metodu API; při chybě vyhodí PacketaError se srozumitelným popisem. */
async function call(method: string, params: Record<string, unknown>): Promise<string> {
  const password = env.packetaApiPassword;
  if (!password) throw new PacketaError("Chybí API heslo Zásilkovny (PACKETA_API_PASSWORD). Zásilku založte ručně v klientské sekci.");

  const body = `<?xml version="1.0" encoding="utf-8"?>\n${toXml(method, { apiPassword: password, ...params })}`;
  let res: Response;
  try {
    res = await fetch(env.packetaApiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PacketaError("Zásilkovna neodpovídá. Zkuste to prosím za chvíli znovu.");
  }
  const xml = await res.text();
  if (tag(xml, "status") !== "ok") {
    const detail = [...xml.matchAll(/<fault>\s*<name>([\s\S]*?)<\/name>\s*<fault>([\s\S]*?)<\/fault>\s*<\/fault>/g)]
      .map((m) => `${unesc(m[1])}: ${unesc(m[2])}`)
      .join("; ");
    const message = tag(xml, "string") ?? tag(xml, "fault") ?? `HTTP ${res.status}`;
    throw new PacketaError(`Zásilkovna odmítla požadavek: ${message}${detail ? ` (${detail})` : ""}`);
  }
  return xml;
}

/** Telefon ve tvaru, který Zásilkovna přijme (+420…). */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return digits.length === 9 ? `+420${digits}` : digits;
}

/** Rozměry zásilky v mm (délka ≥ šířka ≥ výška). */
export type SizeMm = { length: number; width: number; height: number };

export type PacketAttributes = {
  number: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  addressId: string;
  value: number;
  weight: number;
  eshop?: string;
  adultContent: boolean;
  note?: string;
  size?: SizeMm;
};

export async function createPacket(a: PacketAttributes): Promise<{ id: string; barcode: string }> {
  const xml = await call("createPacket", {
    packetAttributes: {
      number: a.number,
      name: a.name,
      surname: a.surname,
      email: a.email,
      phone: a.phone,
      addressId: a.addressId,
      cod: 0,
      value: a.value,
      currency: "CZK",
      weight: a.weight,
      eshop: a.eshop,
      adultContent: a.adultContent ? 1 : 0,
      note: a.note,
      // pořadí prvků je dané schématem API: length, width, height
      size: a.size ? { length: a.size.length, width: a.size.width, height: a.size.height } : undefined,
    },
  });
  const id = tag(xml, "id");
  const barcode = tag(xml, "barcode");
  if (!id || !barcode) throw new PacketaError("Zásilkovna nevrátila číslo zásilky.");
  return { id, barcode };
}

/** PDF se štítky zásilek. */
export async function labelsPdf(packetIds: string[], format: string): Promise<Buffer> {
  const xml = await call("packetsLabelsPdf", { packetIds, format, offset: 0 });
  const b64 = tag(xml, "result");
  if (!b64) throw new PacketaError("Zásilkovna nevrátila štítek.");
  return Buffer.from(b64, "base64");
}

/**
 * Odhad rozměrů krabice podle počtu lahví (lahev 0,7 l v ochranné vložce, ležící).
 * Jen výchozí hodnota do formuláře – před založením zásilky ji lze upravit podle skutečné krabice.
 */
export function estimateSizeMm(bottles: number): SizeMm {
  if (bottles <= 1) return { length: 380, width: 120, height: 120 };
  if (bottles <= 2) return { length: 380, width: 240, height: 120 };
  if (bottles <= 4) return { length: 380, width: 240, height: 240 };
  if (bottles <= 6) return { length: 380, width: 360, height: 240 };
  if (bottles <= 9) return { length: 380, width: 360, height: 360 };
  return { length: 480, width: 380, height: 360 };
}

export type ParcelDraft = {
  /** Pořadí zásilky v objednávce (0, 1, …) */
  index: number;
  number: string;
  bottles: number;
  weightKg: number;
  valueCzk: number;
  size: SizeMm;
};

export type PacketDraft = {
  recipient: { name: string; surname: string; email: string; phone: string };
  addressId: string;
  pointName: string;
  pointAddress: string;
  adultContent: boolean;
  note: string;
  /** Zásilky, které ještě nejsou založené */
  parcels: ParcelDraft[];
  /** Celkový počet zásilek objednávky */
  totalParcels: number;
};

type OrderWithItems = Order & { items: OrderItem[] };

/** Výchozí údaje zásilek k objednávce – zobrazí se v administraci ke kontrole a úpravě před založením. */
export function packetDraft(order: OrderWithItems, settings: Settings): PacketDraft {
  const bottles = order.items.filter((i) => i.type === "BOTTLE").reduce((s, i) => s + i.quantity, 0);
  const parcels = packetaQuote(bottles, shippingRates(settings).packeta).parcels;
  return {
    recipient: {
      name: order.firstName.slice(0, 32),
      surname: order.lastName.slice(0, 32),
      email: order.email,
      phone: normalizePhone(order.phone),
    },
    addressId: order.packetaPointId ?? "",
    pointName: order.packetaPointName ?? "",
    pointAddress: order.packetaPointAddress ?? "",
    adultContent: true,
    note: "",
    totalParcels: parcels.length,
    parcels: parcels
      .map((p, index) => ({
        index,
        number: parcels.length > 1 ? `${order.number}-${index + 1}` : order.number,
        bottles: p.bottles,
        weightKg: p.weightKg,
        // Hodnota pro pojištění: zboží podle podílu lahví v zásilce
        valueCzk: Math.round((order.itemsTotalCzk * p.bottles) / bottles),
        size: estimateSizeMm(p.bottles),
      }))
      .slice(order.packetaPacketIds.length),
  };
}

/** Údaje upravené v administraci před založením (přepíší výchozí návrh). */
export type PacketOverrides = {
  recipient: { name: string; surname: string; email: string; phone: string };
  adultContent: boolean;
  note: string;
  /** Pro každou dosud nezaloženou zásilku v pořadí */
  parcels: { weightKg: number; valueCzk: number; size: SizeMm }[];
};

/**
 * Založí v Zásilkovně zásilky k objednávce (výchozí: s ověřením věku 18+, bez dobírky). Údaje lze před založením
 * upravit (overrides). Opakované volání založí jen ty, které ještě chybí (např. po výpadku uprostřed rozdělené
 * objednávky). Vrací čárové kódy všech zásilek.
 */
export async function createPacketsForOrder(orderId: number, ctx: ActionContext, overrides?: PacketOverrides): Promise<string[]> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new PacketaError("Objednávka neexistuje.");
  if (order.deliveryMethod !== "PACKETA" || !order.packetaPointId) throw new PacketaError("Objednávka se neposílá Zásilkovnou.");
  if (order.status !== "PAID") throw new PacketaError("Zásilku lze založit jen u zaplacené objednávky.");
  if (order.anonymizedAt) throw new PacketaError("Objednávka je anonymizovaná.");

  const settings = await getSettings();
  const draft = packetDraft(order, settings);
  if (draft.parcels.length === 0) return order.packetaBarcodes;
  if (overrides && overrides.parcels.length !== draft.parcels.length) {
    throw new PacketaError("Počet zásilek se mezitím změnil – obnovte stránku.");
  }

  // Pojistka proti dvojímu založení (dvojklik, dvě okna administrace)
  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      OR: [{ packetaRequestedAt: null }, { packetaRequestedAt: { lt: new Date(Date.now() - 2 * 60_000) } }],
    },
    data: { packetaRequestedAt: new Date() },
  });
  if (claimed.count !== 1) throw new PacketaError("Zásilky se právě zakládají – obnovte stránku za chvíli.");

  const recipient = overrides?.recipient ?? draft.recipient;
  const ids = [...order.packetaPacketIds];
  const barcodes = [...order.packetaBarcodes];
  try {
    for (const [i, parcel] of draft.parcels.entries()) {
      const edit = overrides?.parcels[i];
      const created = await createPacket({
        number: parcel.number,
        name: recipient.name,
        surname: recipient.surname,
        email: recipient.email,
        phone: normalizePhone(recipient.phone),
        addressId: draft.addressId,
        value: edit?.valueCzk ?? parcel.valueCzk,
        weight: edit?.weightKg ?? parcel.weightKg,
        size: edit?.size ?? parcel.size,
        eshop: settings.str("packeta.sender") || undefined,
        adultContent: overrides?.adultContent ?? draft.adultContent,
        note: overrides?.note || undefined,
      });
      ids.push(created.id);
      barcodes.push(created.barcode);
      // Uložit hned po každé zásilce – při chybě u další se už založené neztratí
      await prisma.order.update({ where: { id: orderId }, data: { packetaPacketIds: ids, packetaBarcodes: barcodes } });
      const weight = edit?.weightKg ?? parcel.weightKg;
      const age = (overrides?.adultContent ?? draft.adultContent) ? "ověření věku" : "BEZ ověření věku";
      await audit({ action: "packeta_created", orderId, detail: `${created.barcode} (${parcel.bottles} ks, ${weight} kg, ${age})` }, ctx);
    }
  } finally {
    await prisma.order.update({ where: { id: orderId }, data: { packetaRequestedAt: null } });
  }
  return barcodes;
}
