"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Po přechodu na stránku s kotvou (např. /eshop#lahve) posune na danou sekci.
 * Next.js to při načítání přes loading.tsx nedělá spolehlivě – obsah dorazí až po přechodu.
 */
export function ScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    const scroll = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      // Obsah stránky může ještě chvíli dobíhat – zkusit několikrát
      let tries = 0;
      const attempt = () => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ block: "start" });
        else if (tries++ < 20) setTimeout(attempt, 50);
      };
      requestAnimationFrame(attempt);
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, [pathname]);

  return null;
}
