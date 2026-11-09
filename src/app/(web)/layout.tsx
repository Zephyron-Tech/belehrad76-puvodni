import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { CartProvider } from "@/components/cart/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AgeGate } from "@/components/AgeGate";
import { AGE_COOKIE } from "@/lib/consent";
import { CookieConsent } from "@/components/CookieConsent";
import { ScrollToHash } from "@/components/ScrollToHash";

// Sklad, ceny a texty se čtou z databáze při každém požadavku
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = settings.str("seo.description");
  return {
    description,
    openGraph: {
      type: "website",
      locale: "cs_CZ",
      siteName: "Mistři Evropy – Bělehrad 1976",
      title: "Mistři Evropy – Bělehrad 1976",
      description,
      images: [{ url: "/img/box/otevreny.jpg", width: 1280, height: 720, alt: "Box Mistři Evropy – Bělehrad 1976" }],
    },
  };
}

export default async function WebLayout({ children }: { children: React.ReactNode }) {
  const [settings, jar] = await Promise.all([getSettings(), cookies()]);
  const ageVerified = jar.get(AGE_COOKIE)?.value === "1";

  return (
    <CartProvider>
      <a href="#obsah" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:bg-gold focus:p-2 focus:text-ink">
        Přeskočit na obsah
      </a>
      <SiteHeader salesOpen={settings.bool("sales.open")} />
      <main id="obsah">{children}</main>
      <SiteFooter settings={settings} cookieSettings={!!(env.ga4Id || env.metaPixelId)} />
      <AgeGate verified={ageVerified} />
      {/* Bez Google Analytics / Meta Pixel jsou jen nezbytné cookies – souhlas (lišta) není potřeba */}
      {(env.ga4Id || env.metaPixelId) && <CookieConsent ga4Id={env.ga4Id || undefined} metaPixelId={env.metaPixelId || undefined} />}
      <ScrollToHash />
    </CartProvider>
  );
}
