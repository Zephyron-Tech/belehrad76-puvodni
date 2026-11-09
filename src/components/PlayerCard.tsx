import Link from "next/link";
import type { Product } from "@prisma/client";
import { formatCzk } from "@/lib/format";

/** Karta kusovky: fotka lahve hráče (etiketa je v galerii na stránce lahve). */
export function PlayerCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/produkt/${product.slug}`}
      className="group block border border-line bg-panel transition hover:-translate-y-0.5 hover:border-gold/70"
    >
      <div className="aspect-[3/5] overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={`Lahev – ${product.playerName ?? product.name}`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="p-3">
        <p className="text-xs text-muted">č. {product.playerNumber}</p>
        <p className="font-serif text-base leading-tight text-cream group-hover:text-gold-light">{product.playerName}</p>
        <p className="mt-1 text-sm font-semibold text-gold-light">{formatCzk(product.priceCzk)}</p>
      </div>
    </Link>
  );
}
