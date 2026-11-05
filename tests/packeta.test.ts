import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/create";
import { markPaid } from "@/lib/orders/transitions";
import { createPacketsForOrder, labelsPdf, normalizePhone } from "@/lib/packeta";
import { bottlesCheckout, resetDb } from "./helpers";

const admin = { source: "admin" as const, actor: "JN", ip: "127.0.0.1" };

/** Podvržené API Zásilkovny: zapisuje požadavky, vrací úspěšné odpovědi. Na skutečnou Zásilkovnu se nic neposílá. */
function stubPacketaApi(handler?: (body: string, n: number) => string) {
  const requests: string[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe("http://packeta.invalid/api/rest");
    const body = String(init?.body);
    requests.push(body);
    const n = requests.length;
    const xml =
      handler?.(body, n) ??
      `<?xml version="1.0" encoding="utf-8"?><response><status>ok</status><result><id>${1000 + n}</id><barcode>Z${1000 + n}</barcode><barcodeText>Z ${1000 + n}</barcodeText></result></response>`;
    return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return requests;
}

const tagValue = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];

async function paidPacketaOrder(bottles: number) {
  const order = await createOrder(
    bottlesCheckout([{ slug: "viktor", quantity: bottles }], { customer: { firstName: "Jan", lastName: "Novák & syn", email: "jan@example.com", phone: "777 123 456" } }),
    null,
  );
  await markPaid(order.id, admin);
  return order;
}

describe("Zásilkovna – zakládání zásilek přes API", () => {
  beforeEach(() => resetDb());
  afterEach(() => vi.unstubAllGlobals());

  it("telefon převede do mezinárodního tvaru", () => {
    expect(normalizePhone("777 123 456")).toBe("+420777123456");
    expect(normalizePhone("+420 777 123 456")).toBe("+420777123456");
    expect(normalizePhone("00421 900 123 456")).toBe("+421900123456");
  });

  it("založí zásilku na výdejní místo s ověřením věku, bez dobírky, a uloží číslo zásilky", async () => {
    const order = await paidPacketaOrder(3);
    const requests = stubPacketaApi();

    const barcodes = await createPacketsForOrder(order.id, admin);
    expect(barcodes).toEqual(["Z1001"]);
    expect(requests).toHaveLength(1);

    const body = requests[0];
    expect(body).toContain("<createPacket>");
    expect(tagValue(body, "apiPassword")).toBe("test-heslo");
    expect(tagValue(body, "number")).toBe(order.number);
    expect(tagValue(body, "addressId")).toBe("12345");
    expect(tagValue(body, "adultContent")).toBe("1");
    expect(tagValue(body, "cod")).toBe("0");
    expect(tagValue(body, "value")).toBe("2280"); // 3 × 760 Kč
    expect(tagValue(body, "weight")).toBe("3.7");
    expect(tagValue(body, "phone")).toBe("+420777123456");
    expect(tagValue(body, "surname")).toBe("Novák &amp; syn"); // XML escapování

    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.packetaPacketIds).toEqual(["1001"]);
    expect(saved.packetaBarcodes).toEqual(["Z1001"]);
    expect(saved.packetaRequestedAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { orderId: order.id, action: "packeta_created" } })).toBe(1);
  });

  it("opakované kliknutí nezaloží zásilku podruhé", async () => {
    const order = await paidPacketaOrder(1);
    const requests = stubPacketaApi();
    await createPacketsForOrder(order.id, admin);
    expect(await createPacketsForOrder(order.id, admin)).toEqual(["Z1001"]);
    expect(requests).toHaveLength(1);
  });

  it("14 lahví: dvě zásilky (13 + 1) s čísly objednávka-1 a objednávka-2", async () => {
    const order = await paidPacketaOrder(14);
    const requests = stubPacketaApi();
    expect(await createPacketsForOrder(order.id, admin)).toEqual(["Z1001", "Z1002"]);
    expect(requests.map((b) => tagValue(b, "number"))).toEqual([`${order.number}-1`, `${order.number}-2`]);
    expect(requests.map((b) => tagValue(b, "weight"))).toEqual(["14.7", "1.5"]);
    expect(requests.map((b) => tagValue(b, "value"))).toEqual(["9880", "760"]);
  });

  it("chyba u druhé zásilky: první zůstane uložená, další pokus založí jen chybějící", async () => {
    const order = await paidPacketaOrder(14);
    stubPacketaApi((_, n) =>
      n === 2
        ? "<response><status>fault</status><fault>PacketAttributesFault</fault><string>Packet attributes are not valid.</string><detail><attributes><fault><name>addressId</name><fault>Invalid pickup point</fault></fault></attributes></detail></response>"
        : `<response><status>ok</status><result><id>${1000 + n}</id><barcode>Z${1000 + n}</barcode></result></response>`,
    );
    await expect(createPacketsForOrder(order.id, admin)).rejects.toThrow("addressId: Invalid pickup point");
    const partial = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(partial.packetaBarcodes).toEqual(["Z1001"]);
    expect(partial.packetaRequestedAt).toBeNull();

    const retry = stubPacketaApi((_, n) => `<response><status>ok</status><result><id>${2000 + n}</id><barcode>Z${2000 + n}</barcode></result></response>`);
    expect(await createPacketsForOrder(order.id, admin)).toEqual(["Z1001", "Z2001"]);
    expect(retry.map((b) => tagValue(b, "number"))).toEqual([`${order.number}-2`]);
  });

  it("nezaplacenou objednávku ani objednávku bez Zásilkovny nezaloží", async () => {
    const requests = stubPacketaApi();
    const unpaid = await createOrder(bottlesCheckout([{ slug: "viktor", quantity: 1 }]), null);
    await expect(createPacketsForOrder(unpaid.id, admin)).rejects.toThrow("zaplacené");
    const pickup = await createOrder(bottlesCheckout([{ slug: "viktor", quantity: 1 }], { deliveryMethod: "PICKUP", packetaPoint: undefined }), null);
    await markPaid(pickup.id, admin);
    await expect(createPacketsForOrder(pickup.id, admin)).rejects.toThrow("neposílá Zásilkovnou");
    expect(requests).toHaveLength(0);
  });

  it("štítky: PDF z odpovědi API", async () => {
    const pdf = Buffer.from("%PDF-1.4 test");
    const requests = stubPacketaApi(() => `<response><status>ok</status><result>${pdf.toString("base64")}</result></response>`);
    expect((await labelsPdf(["1001", "1002"], "A6 on A4")).toString()).toBe("%PDF-1.4 test");
    expect(requests[0]).toContain("<packetsLabelsPdf>");
    expect(requests[0]).toContain("<packetIds><id>1001</id><id>1002</id></packetIds>");
    expect(tagValue(requests[0], "format")).toBe("A6 on A4");
  });
});
