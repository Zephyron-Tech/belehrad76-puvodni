import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/create";
import { expireStaleOrders } from "@/lib/orders/expire";
import { claimPayment, resendPendingVerifications, resolveVerification, VERIFY_REPEAT_MS } from "@/lib/orders/transfer-verify";
import { sentMailLog } from "@/lib/mail/transport";
import { checkout, resetDb, setSetting } from "./helpers";

const VERIFIER = "rychlikjan52@gmail.com";
const verifier = { source: "verifier" as const, ip: "127.0.0.1" };
const hours = (n: number) => n * 3_600_000;
const mailsTo = (to: string) => sentMailLog.filter((m) => m.to === to);

async function transferOrder() {
  const order = await createOrder(checkout({ paymentMethod: "BANK_TRANSFER" }), null);
  return prisma.order.findUniqueOrThrow({ where: { id: order.id } });
}

describe("platba převodem s ověřováním e-mailem (SPECIFIKACE 5b)", () => {
  beforeEach(() => resetDb());

  it("po objednávce: zákazník dostane QR, ověřovatel hned ověřovací e-mail; převod nemá lhůtu", async () => {
    const order = await transferOrder();
    expect(order.verifyToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(order.verifyState).toBe("WAITING");
    expect(order.reservedUntil).toBeNull();
    expect(order.verifyMailSentAt).not.toBeNull();

    const customer = mailsTo("jan@example.com");
    expect(customer).toHaveLength(1);
    expect(customer[0].attachments).toContain("qr-platba.png");

    const verify = mailsTo(VERIFIER);
    expect(verify).toHaveLength(1);
    expect(verify[0].subject).toContain(`VS ${order.number}`);
    expect(verify[0].subject).toContain("Ověřte platbu");
  });

  it("GoPay objednávka ověřovací e-mail nedostává", async () => {
    await createOrder(checkout({ paymentMethod: "GOPAY" }), null);
    expect(mailsTo(VERIFIER)).toHaveLength(0);
  });

  it("objednávka převodem se automaticky neruší", async () => {
    const order = await transferOrder();
    expect(await expireStaleOrders(new Date(Date.now() + hours(24 * 60)))).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });

  it("bez rozhodnutí se ověřovací e-mail opakuje každých 24 h, ne častěji", async () => {
    await transferOrder();
    sentMailLog.length = 0;
    const t0 = Date.now();

    expect(await resendPendingVerifications(new Date(t0 + hours(23)))).toBe(0);
    expect(await resendPendingVerifications(new Date(t0 + hours(25)))).toBe(1);
    expect(mailsTo(VERIFIER)[0].subject).toContain("Stále neověřeno");
    // stejný den už ne
    expect(await resendPendingVerifications(new Date(t0 + hours(26)))).toBe(0);
    // další den (poslední odeslání t0 + 25 h, + 24 h)
    expect(await resendPendingVerifications(new Date(t0 + hours(25) + VERIFY_REPEAT_MS + hours(1)))).toBe(1);
    expect(mailsTo(VERIFIER)).toHaveLength(2);
  });

  it("neodeslaný ověřovací e-mail (výpadek) se dorovná při nejbližším spuštění", async () => {
    const order = await transferOrder();
    await prisma.order.update({ where: { id: order.id }, data: { verifyMailSentAt: null } });
    sentMailLog.length = 0;
    expect(await resendPendingVerifications()).toBe(1);
    expect(mailsTo(VERIFIER)[0].subject).toContain("Ověřte platbu");
  });

  it("„Zaplatil jsem“ jen zaznamená čas, stav objednávky nemění", async () => {
    const order = await transferOrder();
    expect(await claimPayment(order.publicToken, null)).not.toBeNull();
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paymentClaimedAt).not.toBeNull();
    expect(after.status).toBe("PENDING");
    expect(after.verifyState).toBe("WAITING");
  });

  it("Zaplaceno: objednávka zaplacená, zákazník potvrzení s PDF, ověřování končí", async () => {
    const order = await transferOrder();
    sentMailLog.length = 0;
    expect(await resolveVerification({ verifyToken: order.verifyToken! }, "paid", verifier)).toEqual({ done: true, action: "paid" });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PAID");
    expect(after.verifyState).toBeNull();
    const confirmation = mailsTo("jan@example.com").find((m) => m.subject.includes("Platba za objednávku"));
    expect(confirmation?.attachments.some((a) => a.endsWith(".pdf"))).toBe(true);
    expect(await resendPendingVerifications(new Date(Date.now() + hours(48)))).toBe(0);

    // opakované kliknutí na odkaz
    expect(await resolveVerification({ verifyToken: order.verifyToken! }, "paid", verifier)).toEqual({ done: false, reason: "already-paid" });
  });

  it("Nezaplaceno – vyřeším sám: opakování končí, objednávka dál čeká", async () => {
    const order = await transferOrder();
    await resolveVerification({ verifyToken: order.verifyToken! }, "manual", verifier);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PENDING");
    expect(after.verifyState).toBe("MANUAL");
    sentMailLog.length = 0;
    expect(await resendPendingVerifications(new Date(Date.now() + hours(72)))).toBe(0);
  });

  it("Nezaplaceno – poslat upomínku: zákazník dostane upomínku s QR, ověřování znovu za 24 h", async () => {
    const order = await transferOrder();
    await resolveVerification({ verifyToken: order.verifyToken! }, "manual", verifier);
    sentMailLog.length = 0;

    expect(await resolveVerification({ verifyToken: order.verifyToken! }, "remind", verifier)).toEqual({ done: true, action: "remind" });
    const reminder = mailsTo("jan@example.com");
    expect(reminder).toHaveLength(1);
    expect(reminder[0].subject).toContain("Připomínka platby");
    expect(reminder[0].attachments).toContain("qr-platba.png");

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.reminderCount).toBe(1);
    expect(after.verifyState).toBe("WAITING");

    const t0 = Date.now();
    expect(await resendPendingVerifications(new Date(t0 + hours(23)))).toBe(0);
    expect(await resendPendingVerifications(new Date(t0 + hours(25)))).toBe(1);
  });

  it("neplatný token a zrušená objednávka", async () => {
    expect(await resolveVerification({ verifyToken: "neexistuje-neexistuje-neexistuje" }, "paid", verifier)).toEqual({
      done: false,
      reason: "not-found",
    });
    const order = await transferOrder();
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    expect(await resolveVerification({ verifyToken: order.verifyToken! }, "remind", verifier)).toEqual({
      done: false,
      reason: "cancelled",
    });
  });

  it("bez nastaveného ověřovatele se ověřovací e-mail neposílá", async () => {
    await setSetting("payment.verify_email", "");
    await transferOrder();
    expect(sentMailLog.filter((m) => m.subject.includes("Ověřte platbu"))).toHaveLength(0);
  });
});
