import { headers } from "next/headers";

/**
 * IP adresa klienta z X-Forwarded-For. Bere se poslední adresa – tu přidal náš proxy
 * (Traefik ji připojí na konec, Vercel hlavičku přepíše). První adresu může klient
 * podvrhnout a obejít tak omezení počtu pokusů.
 */
export function ipFromHeaders(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)?.trim() || null;
  return h.get("x-real-ip");
}

export async function getClientIp(): Promise<string | null> {
  return ipFromHeaders(await headers());
}

/**
 * Načte tělo požadavku jako JSON s limitem velikosti (ochrana proti zahlcení paměti obřím polem).
 * Vrací null při překročení limitu nebo neplatném JSON.
 */
export async function readJson(req: Request, maxBytes: number): Promise<unknown | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return null;
  const text = await req.text().catch(() => "");
  if (!text || Buffer.byteLength(text) > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
