"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartIssue, PricedCart } from "@/lib/cart";
import { useCart, type CartLine } from "./CartProvider";

export type PricedCartResponse = PricedCart & { salesOpen: boolean; pickupEnabled: boolean; leadTime: string; boxDelivery: string; startNote: string };

/** Ocení košík na serveru při každé změně (aktuální ceny, sklad a doprava). */
export function usePricedCart(lines: CartLine[], ready: boolean) {
  const [data, setData] = useState<PricedCartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Zvýšením se košík ocení znovu i beze změny položek (např. po chybě objednávky kvůli skladu)
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const key = JSON.stringify(lines);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/kosik", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: key === "[]" ? '{"lines":[]}' : JSON.stringify({ lines: JSON.parse(key) }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Košík se nepodařilo načíst.");
        setData((await res.json()) as PricedCartResponse);
        setError(null);
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [key, ready, nonce]);

  return { data, loading, error, refresh };
}

/**
 * Ocení košík a srovná ho se serverem: vyprodané a neaktivní položky odebere, počty upraví na
 * dostupné množství. Hlášky o úpravách (`notices`) zůstanou zobrazené, i když se košík mezitím
 * srovnal – zákazník tak vidí, proč se košík změnil. Používá košík i pokladna.
 */
export function useSyncedPricedCart() {
  const { lines, ready, replace } = useCart();
  const priced = usePricedCart(lines, ready);
  const { data } = priced;
  const [notices, setNotices] = useState<CartIssue[]>([]);

  useEffect(() => {
    if (!data || data.issues.length === 0) return;
    setNotices((prev) => [...prev.filter((p) => !data.issues.some((i) => i.slug === p.slug)), ...data.issues]);
    const next = data.lines.map((l) => ({ slug: l.slug, quantity: l.quantity }));
    const same = next.length === lines.length && next.every((n) => lines.some((l) => l.slug === n.slug && l.quantity === n.quantity));
    if (!same) replace(next);
  }, [data, lines, replace]);

  /** Košík je srovnaný se serverem a lze z něj objednat. */
  const inSync = !!data && data.issues.length === 0;
  return { ...priced, ready, notices, inSync };
}
