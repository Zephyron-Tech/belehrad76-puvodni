import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { effectivePin, safeNext } from "@/lib/site-pin";
import { Seal } from "@/components/Seal";
import { PinForm } from "./PinForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Připravujeme", robots: { index: false, follow: false } };

/** Vstup na web před spuštěním – jen s PINem (nastavení site.pin). */
export default async function PinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (!effectivePin((await getSettings()).str("site.pin"))) redirect(next);
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <div className="w-full max-w-sm border border-gold/40 bg-panel p-8 text-center shadow-2xl">
        <Seal size={96} className="mx-auto mb-4" />
        <p className="font-serif text-lg font-bold tracking-[0.12em] text-gold">MISTŘI EVROPY</p>
        <p className="text-xs tracking-[0.42em] text-cream/80">BĚLEHRAD 1976</p>
        <p className="mt-6 text-cream/90">Web připravujeme. Vstup je zatím jen s PINem.</p>
        <PinForm next={next} />
      </div>
    </div>
  );
}
