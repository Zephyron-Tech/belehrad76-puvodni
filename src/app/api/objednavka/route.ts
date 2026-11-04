import { NextResponse } from "next/server";
import { createOrder, CheckoutError } from "@/lib/orders/create";
import { startGopayPayment, orderUrl } from "@/lib/orders/payments";
import { ipFromHeaders, readJson } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

/** Odeslání objednávky z pokladny. Vrací adresu, kam zákazníka přesměrovat. */
export async function POST(req: Request) {
  const ip = ipFromHeaders(req.headers);
  const limited = rateLimit(`checkout:${ip ?? "unknown"}`, 10, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Příliš mnoho pokusů o objednávku. Zkuste to prosím za chvíli." }, { status: 429 });
  }

  // objednávka má jednotky kB; víc je pokus o zahlcení
  const body = (await readJson(req, 32_768)) as { turnstileToken?: string } | null;
  if (!body) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });

  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ error: "Ověření, že nejste robot, se nezdařilo. Zkuste to prosím znovu." }, { status: 400 });
  }

  try {
    const order = await createOrder(body, ip);
    let redirectUrl = orderUrl(order.publicToken);
    if (order.paymentMethod === "GOPAY") {
      try {
        redirectUrl = await startGopayPayment(order.id);
      } catch (err) {
        // Objednávka je založená – zákazník může platbu spustit znovu ze stránky objednávky
        console.error("[gopay] create payment failed", err);
        redirectUrl = `${orderUrl(order.publicToken)}?platba=chyba`;
      }
    }
    return NextResponse.json({ ok: true, redirectUrl, orderNumber: order.number });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message, fieldErrors: err.fieldErrors }, { status: 422 });
    }
    console.error("[checkout] failed", err);
    return NextResponse.json({ error: "Objednávku se nepodařilo odeslat. Zkuste to prosím znovu." }, { status: 500 });
  }
}
