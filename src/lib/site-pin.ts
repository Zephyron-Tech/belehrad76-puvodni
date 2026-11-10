import crypto from "node:crypto";
import { env } from "./env";

/**
 * Web za PINem (před spuštěním): nastavení `site.pin`. Prázdné = web je veřejný.
 * Kdo zadá správný PIN, dostane cookie s otiskem PINu (platí 30 dní). Po změně PINu přestanou staré
 * cookie platit; po vymazání PINu (release) je web dostupný všem.
 */
export const SITE_PIN_COOKIE = "site_pin";
export const SITE_PIN_MAX_AGE_S = 30 * 24 * 60 * 60;

/** Cesty, které jsou dostupné i bez PINu (administrace, služby, ověřovací odkazy z e-mailů, stránka s PINem). */
const EXEMPT = ["/pin", "/admin", "/api/", "/overeni-platby", "/robots.txt", "/sitemap.xml", "/icon.svg", "/apple-icon.png"];

/**
 * Platný PIN webu. Proměnná prostředí SITE_PIN má přednost před nastavením v databázi:
 *  - SITE_PIN=1234 → web je vždy za tímto PINem (např. testovací nasazení na Vercelu),
 *  - SITE_PIN=off  → web je vždy veřejný bez ohledu na databázi,
 *  - nenastaveno   → rozhoduje nastavení `site.pin` v administraci.
 */
export function effectivePin(settingPin: string) {
  const fromEnv = env.sitePin;
  if (fromEnv) return /^(off|false|0|no)$/i.test(fromEnv) ? "" : fromEnv;
  return settingPin.trim();
}

/**
 * PIN, který na testovacím nasazení nahradí kód z autentikátoru při přihlášení do administrace.
 * Jen když je PIN nastavený proměnnou prostředí SITE_PIN (ne v administraci) – na produkci bez SITE_PIN
 * (i když je web před spuštěním za PINem z administrace) je vždy potřeba kód z autentikátoru.
 */
export function adminPinFor2fa() {
  const fromEnv = env.sitePin;
  return fromEnv && !/^(off|false|0|no)$/i.test(fromEnv) ? fromEnv : "";
}

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
