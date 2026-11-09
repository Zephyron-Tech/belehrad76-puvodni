import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getProductBySlug, shippingRates } from "@/lib/catalog";
import { bottleShippingFromCzk } from "@/lib/shipping";
import { getSettings } from "@/lib/settings";
import { formatCzk } from "@/lib/format";
import { maybeExpireStaleOrders } from "@/lib/orders/expire";
import { Markdown } from "@/components/Markdown";
import { StockBadge } from "@/components/StockBadge";
import { AddToCart } from "@/components/cart/AddToCart";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.shortDescription,
    // Náhled při sdílení jako JPEG (Facebook WebP spolehlivě nezobrazí)
    openGraph: { title: product.name, description: product.shortDescription, images: [product.imageUrl.replace(/\.webp$/, ".jpg")] },
  };
}

export default async function ProductPage({ params }: Props) {
  maybeExpireStaleOrders();
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!product) notFound();
  // Box nemá vlastní stránku – kupuje se přímo v e-shopu (kvůli gólu nad nadpisem)
  if (product.type === "BOX") permanentRedirect("/eshop");

  // Stránka kusovky (jednotlivé lahve hráče)
  const salesOpen = settings.bool("sales.open");
  const gallery = [product.imageUrl, ...product.galleryUrls.filter((u) => u !== product.imageUrl)];
  const max = settings.num("order.max_bottles");
  const shippingText = `Doprava Zásilkovnou na výdejní místo od ${formatCzk(bottleShippingFromCzk(shippingRates(settings)))} za zásilku (podle hmotnosti), s boxem v objednávce kurýrem jen ${formatCzk(settings.num("shipping.box_czk"))} za celou zásilku.`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <nav aria-label="Drobečková navigace" className="text-sm text-muted">
        <Link href="/eshop" className="hover:text-gold-light">
          E-shop
        </Link>{" "}
        / <span className="text-cream">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          {gallery.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={i === 0 ? `Lahev ${product.name}` : `Etiketa – ${product.playerName ?? product.name}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="mx-auto w-full max-w-sm border border-line bg-white"
            />
          ))}
        </div>

        <div>
          <p className="text-sm text-muted">Hráč č. {product.playerNumber}</p>
          <h1 className="font-serif text-4xl font-bold text-cream">{product.name}</h1>
          <p className="mt-3 text-lg text-cream/85">{product.shortDescription}</p>
          <p className="mt-6 font-serif text-4xl font-bold text-gold-light">{formatCzk(product.priceCzk)}</p>
          <p className="mt-1 text-sm text-muted">
            Cena včetně DPH. {shippingText} Nebo osobní převzetí na FAČR zdarma. {settings.str("shipping.start_note")}
          </p>
          <div className="mt-4">
            <StockBadge stock={product.stock} />
          </div>
          {product.madeToOrder && (
            <p className="mt-4 border-l-2 border-gold pl-3 text-sm text-cream/85">{settings.text("bottle.lead_time")}</p>
          )}

          <div className="mt-6">
            {salesOpen ? (
              <AddToCart slug={product.slug} max={max} />
            ) : (
              <p className="border border-line p-3 text-sm text-muted">E-shop bude brzy spuštěn.</p>
            )}
          </div>

          <Markdown source={product.description} settings={settings} className="mt-8" />

          <p className="mt-6 text-sm text-muted">
            Kdo si v předprodeji objedná box, může se zařadit do losování o vstup na galavečer {settings.str("evening.date")}.{" "}
            <Link href="/#vecer" className="text-gold-light underline underline-offset-4">
              Více o večeru
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
}
