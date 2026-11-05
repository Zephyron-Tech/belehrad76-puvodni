import Link from "next/link";
import { CartButton } from "./cart/CartButton";

const NAV = [
  { href: "/#edice", label: "Edice" },
  { href: "/eshop", label: "E-shop" },
  { href: "/#vecer", label: "Slavnostní večer" },
  { href: "/#nadace", label: "Nadace" },
  { href: "/kontakt", label: "Kontakt" },
];

export function SiteHeader({ salesOpen }: { salesOpen: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group leading-none" aria-label="Mistři Evropy – Bělehrad 1976, úvod">
          <span className="block font-serif text-lg font-bold tracking-[0.12em] text-gold sm:text-xl">MISTŘI EVROPY</span>
          <span className="block text-[0.65rem] tracking-[0.42em] text-cream/80">BĚLEHRAD 1976</span>
        </Link>
        <nav aria-label="Hlavní navigace" className="hidden md:block">
          <ul className="flex gap-6 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-cream/85 transition hover:text-gold-light">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          {salesOpen && <CartButton />}
          <details className="relative md:hidden">
            <summary className="cursor-pointer list-none border border-line px-3 py-2 text-sm text-cream" aria-label="Menu">
              Menu
            </summary>
            <ul className="absolute right-0 mt-2 w-56 border border-line bg-panel p-2 shadow-xl">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block px-3 py-2 text-cream hover:bg-panel-2 hover:text-gold-light">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </header>
  );
}
