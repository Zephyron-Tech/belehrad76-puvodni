import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { SITE_PIN_COOKIE, effectivePin, isPinExempt, pinToken } from "@/lib/site-pin";

/** Cesty volané službami (GoPay, cron, healthcheck) – bez hesla vývojové verze */
const BASIC_AUTH_EXEMPT = ["/api/gopay/notify", "/api/cron/", "/api/health"];

/**
 * Vývojová verze (DEV_BASIC_AUTH="jmeno:heslo"): celý web za HTTP heslem a noindex.
 * Na ostré verzi proměnnou nenastavovat.
 */
function devBasicAuth(req: NextRequest): NextResponse | null {
  const expected = (process.env.DEV_BASIC_AUTH ?? "").trim();
  if (!expected) return null;
  if (BASIC_AUTH_EXEMPT.some((p) => req.nextUrl.pathname.startsWith(p))) return null;

  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Basic ") ? Buffer.from(header.slice(6), "base64").toString() : "";
  const ok =
    given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (ok) return null;
  return new NextResponse("Vývojová verze – přístup jen s heslem.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Mistri Evropy DEV", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
  });
}

/**
 * - Vývojová verze za heslem (DEV_BASIC_AUTH).
 * - Přesměrování vedlejších domén (např. belehrad1976.cz) na hlavní doménu (PRIMARY_HOST).
 * - Web za PINem před spuštěním (site.pin) – kromě administrace, API a ověřovacích odkazů.
 * - /admin: bez cookie session rovnou na přihlášení, hlavička noindex.
 *   (Skutečné ověření session probíhá na serveru v requireAdmin / getAdminSession.)
 */
export async function middleware(req: NextRequest) {
  const denied = devBasicAuth(req);
  if (denied) return denied;

  const primary = (process.env.PRIMARY_HOST ?? "").trim().toLowerCase();
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const isApi = req.nextUrl.pathname.startsWith("/api/");
  if (primary && host && host !== primary && host !== "localhost" && host !== "127.0.0.1" && !isApi) {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    url.host = primary;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Web za PINem před spuštěním (nastavení site.pin; prázdné = veřejný web)
  if (!isPinExempt(req.nextUrl.pathname)) {
    const pin = effectivePin((await getSettings()).str("site.pin"));
    if (pin && req.cookies.get(SITE_PIN_COOKIE)?.value !== pinToken(pin)) {
      const url = req.nextUrl.clone();
      url.pathname = "/pin";
      url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
      const res = NextResponse.redirect(url);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
  }

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin")) {
    const isLogin = pathname === "/admin/login";
    if (!isLogin && !req.cookies.get("admin_session")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const res = NextResponse.next();
  if (process.env.DEV_BASIC_AUTH || process.env.DEV_NOINDEX === "true") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|img/|favicon.ico).*)"],
};
