import type { Metadata } from "next";
import { getActiveProducts, shippingRates } from "@/lib/catalog";
import { bottleShippingFromCzk } from "@/lib/shipping";
import { getSettings } from "@/lib/settings";
import { formatCzk } from "@/lib/format";
import { maybeExpireStaleOrders } from "@/lib/orders/expire";
import { PlayerCard } from "@/components/PlayerCard";
import { StockBadge } from "@/components/StockBadge";
import { AddToCart } from "@/components/cart/AddToCart";
import { GoalKick } from "@/components/GoalKick";

export const metadata: Metadata = { title: "E-shop" };

export default async function EshopPage() {
  maybeExpireStaleOrders();
  const [settings, products] = await Promise.all([getSettings(), getActiveProducts()]);
  const boxes = products.filter((p) => p.type === "BOX");
  const bottles = products.filter((p) => p.type === "BOTTLE");
  const salesOpen = settings.bool("sales.open");

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="font-serif text-4xl font-bold text-gold">E-shop</h1>
      <p className="mt-3 max-w-2xl text-cream/80">
        Sběratelská edice k 50. výročí zlatého Bělehradu – 13 lahví slivovice za 13 mistrů Evropy. Výtěžek edice jde
        na podporu Nadace fotbalových internacionálů.
      </p>
      {!salesOpen && (
        <p className="mt-6 border border-warn/60 bg-warn/10 p-4 text-cream">Prodej bude brzy spuštěn. Děkujeme za trpělivost.</p>
      )}

      {boxes.map((box) => (
        <section key={box.id} className="mt-10 grid gap-8 border border-line bg-panel p-5 md:grid-cols-[1.2fr_1fr] md:p-8">
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={box.imageUrl} alt={`${box.name} – otevřený box s 13 lahvemi`} className="w-full border border-line" />
            {box.galleryUrls.filter((u) => u !== box.imageUrl).length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {box.galleryUrls
                  .filter((u) => u !== box.imageUrl)
                  .map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt={i === 0 ? "Třináct lahví edice vedle sebe" : `${box.name} – zavřený box`}
                      loading="lazy"
                      className="aspect-[16/9] w-full border border-line bg-white object-contain"
                    />
                  ))}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            {/* Nad nadpisem panáček s míčem a branka – po přidání boxu do košíku vstřelí gól */}
            <div className="self-start">
              <GoalKick slug={box.slug} />
              <h2 className="font-serif text-3xl font-bold text-cream">{box.name}</h2>
            </div>
            <p className="mt-3 text-cream/85">{box.shortDescription}</p>
            <p className="mt-5 font-serif text-4xl font-bold text-gold-light">
              {bottles.length > 0 && (
                <span className="mr-2 align-middle font-sans text-base font-normal text-muted">
                  {bottles.length} × {formatCzk(bottles[0].priceCzk)} =
                </span>
              )}
              {formatCzk(box.priceCzk)}
            </p>
            <p className="mt-1 text-sm text-muted">
              Doprava {formatCzk(settings.num("shipping.box_czk"))} za celou objednávku. Osobní převzetí v{"\u00a0"}sídle FAČR
              v{"\u00a0"}Praze zdarma.
            </p>
            <p className="mt-1 text-sm text-muted">{settings.text("box.delivery")}</p>
            <div className="mt-4">
              <StockBadge stock={box.stock} />
            </div>
            <div className="mt-6">
              {salesOpen && (
                <>
                  <AddToCart slug={box.slug} max={Math.min(box.stock ?? 0, settings.num("order.max_boxes"))} />
                  <p className="mt-2 text-[0.8125rem] text-muted">Chceš si dát Panenkův dloubák? Dej box do košíku.</p>
                </>
              )}
            </div>
          </div>
        </section>
      ))}

      <section id="lahve" className="mt-16 scroll-mt-20">
        <h2 className="font-serif text-3xl font-bold text-gold">Lahve jednotlivých hráčů</h2>
        <p className="mt-2 max-w-2xl text-cream/80">
          Vyberte si svého hráče – každá lahev slivovice 50 % nese jeho portrét, jméno a číslo dresu.{" "}
          {settings.text("bottle.lead_time")} Lahve posíláme Zásilkovnou na výdejní místo od{" "}
          {formatCzk(bottleShippingFromCzk(shippingRates(settings)))} za zásilku (podle hmotnosti, s ověřením věku 18+), s boxem
          v objednávce kurýrem za {formatCzk(settings.num("shipping.box_czk"))} za celou zásilku. Osobní převzetí na FAČR je zdarma.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {bottles.map((p) => (
            <div key={p.id} className="flex flex-col gap-2">
              <PlayerCard product={p} />
              {salesOpen && <AddToCart slug={p.slug} max={settings.num("order.max_bottles")} compact />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
