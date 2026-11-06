"use client";

import { useEffect } from "react";

/**
 * Po rozhodnutí ověřovatele: zkusí zavřít okno, a pokud to prohlížeč nedovolí (okno neotevřel skript),
 * přesměruje na úvodní stránku.
 */
export function AutoClose({ delayMs = 2500 }: { delayMs?: number }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.close();
      // Když se okno nezavřelo, pokračovat na úvod
      setTimeout(() => window.location.replace("/"), 400);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return null;
}
