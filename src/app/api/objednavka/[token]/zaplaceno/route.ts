import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ipFromHeaders } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { claimPayment } from "@/lib/orders/transfer-verify";

/**
 * Zákazník klikl „Zaplatil jsem“ (odkaz z upomínky → formulář na stránce objednávky). Ověřovateli hned odejde ověřovací e-mail
 * „Zákazník hlásí platbu“ – rychlejší ověření (SPECIFIKACE 5b). Stav objednávky se nemění.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new NextResponse("Not found", { status: 404 });
  const ip = ipFromHeaders(req.headers);
  if (rateLimit(`claim:${ip ?? "unknown"}`, 20, 10 * 60_000).ok) {
    await claimPayment(token, ip).catch((err) => console.error("[verify] claim failed", err));
  }
  return NextResponse.redirect(`${env.appUrl}/objednavka/${token}?zaplaceno=1#zaplatil`, 303);
}
