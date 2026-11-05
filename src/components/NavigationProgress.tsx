"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Zlatý proužek nahoře při přechodu na jinou stránku – hned po kliknutí na odkaz,
 * dokud se nová stránka nenačte. Stažení souborů (exporty, štítky) ho nespouští.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  // Nová stránka je vykreslená → proužek schovat
  useEffect(() => setActive(false), [pathname]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      // soubory ke stažení – stránka se nemění
      if (/^\/admin\/(export|zasilkovna)\//.test(url.pathname)) return;
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), 15_000); // pojistka
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimeout(timer);
    };
  }, []);

  if (!active) return null;
  return (
    <div role="progressbar" aria-label="Načítám stránku" className="fixed inset-x-0 top-0 z-[300] h-1 overflow-hidden bg-gold/15">
      <div className="nav-progress h-full w-1/3 bg-gold shadow-[0_0_8px_var(--gold)]" />
    </div>
  );
}
