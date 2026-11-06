import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ipFromHeaders } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { resolveVerification, type VerifyAction } from "@/lib/orders/transfer-verify";

const ACTIONS: VerifyAction[] = ["paid", "manual", "remind"];

/**
 * Rozhodnutí ověřovatele z ověřovací stránky (SPECIFIKACE 5b): Zaplaceno / Nezaplaceno – vyřeším sám /
 * Nezaplaceno – poslat upomínku. Bez přihlášení, přístup jen s tajným tokenem. Jen POST – odkazy z e-mailu
 * (GET) samy nic nemění.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new NextResponse("Not found", { status: 404 });
  const page = `${env.appUrl}/overeni-platby/${token}`;

  const ip = ipFromHeaders(req.headers);
  if (!rateLimit(`verify:${ip ?? "unknown"}`, 30, 10 * 60_000).ok) {
    return new NextResponse("Příliš mnoho pokusů. Zkuste to prosím za chvíli.", { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const action = String(form?.get("action") ?? "") as VerifyAction;
  if (!ACTIONS.includes(action)) return NextResponse.redirect(page, 303);

  try {
    const result = await resolveVerification({ verifyToken: token }, action, { source: "verifier", ip });
    if (!result.done && result.reason === "not-found") return new NextResponse("Not found", { status: 404 });
    return NextResponse.redirect(result.done ? `${page}?hotovo=${action}` : page, 303);
  } catch (err) {
    console.error("[verify] resolve failed", err);
    return NextResponse.redirect(`${page}?stav=chyba`, 303);
  }
}
