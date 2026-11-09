import crypto from "node:crypto";

/**
 * Web za PINem (před spuštěním): nastavení `site.pin`. Prázdné = web je veřejný.
 * Kdo zadá správný PIN, dostane cookie s otiskem PINu (platí 30 dní). Po změně PINu přestanou staré
 * cookie platit; po vymazání PINu (release) je web dostupný všem.
 */
export const SITE_PIN_COOKIE = "site_pin";
export const SITE_PIN_MAX_AGE_S = 30 * 24 * 60 * 60;

/** Cesty, které jsou dostupné i bez PINu (administrace, služby, ověřovací odkazy z e-mailů, stránka s PINem). */
const EXEMPT = ["/pin", "/admin", "/api/", "/overeni-platby", "/robots.txt", "/sitemap.xml", "/icon.svg", "/apple-icon.png"];

export function isPinExempt(pathname: string) {
  return EXEMPT.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

export function pinToken(pin: string) {
  return crypto.createHash("sha256").update(`belehrad76-site-pin:${pin}`).digest("base64url");
}

export function pinMatches(given: string, pin: string) {
  const a = Buffer.from(pinToken(given));
  const b = Buffer.from(pinToken(pin));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Bezpečný návrat po zadání PINu – jen relativní cesta na tomto webu. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/pin") ? next : "/";
}
