"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { SITE_PIN_COOKIE, SITE_PIN_MAX_AGE_S, effectivePin, pinMatches, pinToken, safeNext } from "@/lib/site-pin";

export async function submitPin(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const pin = effectivePin((await getSettings()).str("site.pin"));
  const next = safeNext(String(form.get("next") ?? ""));
  if (!pin) redirect(next);
  const given = String(form.get("pin") ?? "").trim();
  if (!pinMatches(given, pin)) {
    // Zpomalení zkoušení PINů
    await new Promise((r) => setTimeout(r, 800));
    return { error: "Nesprávný PIN." };
  }
  (await cookies()).set(SITE_PIN_COOKIE, pinToken(pin), {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: SITE_PIN_MAX_AGE_S,
  });
  redirect(next);
}
