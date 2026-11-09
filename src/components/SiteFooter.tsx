import Link from "next/link";
import type { Settings } from "@/lib/settings";
import { CookieSettingsLink } from "./CookieConsent";
import { SocialLinks } from "./SocialLinks";

const LEGAL = [
  { href: "/obchodni-podminky", label: "Obchodní podmínky" },
  { href: "/ochrana-osobnich-udaju", label: "Ochrana osobních údajů" },
  { href: "/cookies", label: "Cookies" },
  { href: "/reklamacni-rad", label: "Reklamační řád" },
  { href: "/odstoupeni-od-smlouvy", label: "Odstoupení od smlouvy" },
];

export function SiteFooter({ settings, cookieSettings = false }: { settings: Settings; cookieSettings?: boolean }) {
  return (
    <footer className="mt-24 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <p className="font-serif text-lg font-bold tracking-[0.12em] text-gold">MISTŘI EVROPY</p>
          <p className="text-xs tracking-[0.42em] text-cream/80">BĚLEHRAD 1976</p>
          <p className="mt-4 text-sm text-muted">Výtěžek edice jde na podporu Nadace fotbalových internacionálů.</p>
          <SocialLinks settings={settings} className="mt-4" />
        </div>
        <div className="text-sm text-muted">
          <p className="font-semibold text-cream">Prodávající</p>
          <p className="mt-2">
            {settings.str("seller.name")}
            <br />
            {settings.str("seller.address")}
            <br />
            IČO {settings.str("seller.ico")}, DIČ {settings.str("seller.dic")}
          </p>
          <p className="mt-3">
            <a href={`mailto:${settings.str("contact.email")}`} className="text-gold-light hover:underline">
              {settings.str("contact.email")}
            </a>
            {settings.str("contact.phone") && (
              <>
                <br />
                <a href={`tel:${settings.str("contact.phone").replace(/\s/g, "")}`} className="hover:text-cream">
                  {settings.str("contact.phone")}
                </a>
              </>
            )}
          </p>
        </div>
        <nav aria-label="Právní informace" className="text-sm">
          <ul className="space-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-muted hover:text-gold-light">
                  {l.label}
                </Link>
              </li>
            ))}
            {cookieSettings && (
              <li>
                <CookieSettingsLink className="text-muted hover:text-gold-light" />
              </li>
            )}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
          <strong className="text-cream">18+</strong> Prodej alkoholu osobám mladším 18 let je zakázán. Pijte zodpovědně.
        </p>
      </div>
    </footer>
  );
}
