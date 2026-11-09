"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { useSyncedPricedCart } from "@/components/cart/usePricedCart";
import { formatCzk } from "@/lib/format";
import { SkeletonLines } from "@/components/Loading";

export function CartView() {
  const { setQuantity, remove, lines } = useCart();
  const { data, loading, error, ready, notices } = useSyncedPricedCart();

  if (!ready || (loading && !data)) return <SkeletonLines rows={Math.min(Math.max(lines.length, 1), 4)} />;
  if (error) return <p className="mt-8 text-danger">{error}</p>;

  if (!data || data.lines.length === 0) {
    return (
      <div className="mt-8 border border-line bg-panel p-8 text-center">
        <p className="text-cream">Košík je prázdný.</p>
        {notices.map((i) => (
          <p key={i.slug} className="mt-2 text-sm text-warn">
            {i.message}
          </p>
        ))}
        <Link href="/eshop" className="mt-6 inline-block bg-gold px-6 py-3 font-bold uppercase tracking-wider text-ink">
          Do e-shopu
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {notices.length > 0 && (
        <div className="mb-6 border border-warn/60 bg-warn/10 p-4 text-sm text-cream" role="status">
          {notices.map((i) => (
            <p key={i.slug}>{i.message}</p>
          ))}
        </div>
      )}

      <ul className="divide-y divide-line border-y border-line">
        {data.lines.map((line) => (
          <li key={line.slug} className="flex gap-4 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={line.imageUrl}
              alt=""
              className="h-24 w-20 shrink-0 border border-line bg-white object-cover"
            />
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={line.type === "BOX" ? "/eshop" : `/produkt/${line.slug}`} className="font-serif text-lg text-cream hover:text-gold-light">
                  {line.name}
                </Link>
                <p className="text-sm text-muted">{formatCzk(line.unitPriceCzk)} / ks</p>
                {line.madeToOrder && <p className="text-xs text-muted">Vyrábí se na objednávku</p>}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-line" role="group" aria-label={`Počet – ${line.name}`}>
                  <button
                    type="button"
                    className="px-3 py-2 text-gold-light disabled:opacity-40"
                    onClick={() => setQuantity(line.slug, line.quantity - 1)}
                    disabled={line.quantity <= 1}
                    aria-label="Méně"
                  >
                    −
                  </button>
                  <span className="w-10 text-center" aria-live="polite">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    className="px-3 py-2 text-gold-light disabled:opacity-40"
                    onClick={() => setQuantity(line.slug, line.quantity + 1)}
                    disabled={line.quantity >= line.maxQuantity}
                    aria-label="Více"
                  >
                    +
                  </button>
                </div>
                <p className="w-28 text-right font-semibold text-gold-light">{formatCzk(line.lineTotalCzk)}</p>
                <button type="button" onClick={() => remove(line.slug)} className="text-sm text-muted underline hover:text-danger">
                  Odebrat
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <dl className="ml-auto mt-6 max-w-sm space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Zboží</dt>
          <dd>{formatCzk(data.itemsTotalCzk)}</dd>
        </div>
        {data.shipping.PACKETA !== null && (
          <div className="flex justify-between">
            <dt className="text-muted">Zásilkovna – výdejní místo</dt>
            <dd>{formatCzk(data.shipping.PACKETA)}</dd>
          </div>
        )}
        {data.shipping.SHIPPING !== null && (
          <div className="flex justify-between">
            <dt className="text-muted">Kurýr na adresu</dt>
            <dd>{formatCzk(data.shipping.SHIPPING)}</dd>
          </div>
        )}
        {data.pickupEnabled && (
          <div className="flex justify-between">
            <dt className="text-muted">nebo osobní převzetí na FAČR</dt>
            <dd>zdarma</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
          <dt>Celkem s dopravou</dt>
          <dd className="text-gold-light">{formatCzk(data.itemsTotalCzk + (data.shipping.PACKETA ?? data.shipping.SHIPPING ?? 0))}</dd>
        </div>
      </dl>

      {data.boxes > 0 && <p className="mt-6 border-l-2 border-gold pl-3 text-sm text-cream/85">{data.boxDelivery}</p>}
      {data.hasMadeToOrder && <p className="mt-3 border-l-2 border-gold pl-3 text-sm text-cream/85">{data.leadTime}</p>}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link href="/eshop" className="border border-line px-6 py-3 text-center text-cream hover:border-gold">
          Pokračovat v nákupu
        </Link>
        {data.salesOpen ? (
          <Link href="/pokladna" className="bg-gold px-8 py-3 text-center font-bold uppercase tracking-wider text-ink hover:bg-gold-light">
            K objednávce
          </Link>
        ) : (
          <p className="text-sm text-muted">E-shop bude brzy spuštěn.</p>
        )}
      </div>
    </div>
  );
}
