import Link from "next/link";
import { getActiveProducts, getPage } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { formatCzk } from "@/lib/format";
import { maybeExpireStaleOrders } from "@/lib/orders/expire";
import { Seal } from "@/components/Seal";
import { Markdown } from "@/components/Markdown";
import { PlayerCard } from "@/components/PlayerCard";
import { StockBadge } from "@/components/StockBadge";
import { SocialLinks } from "@/components/SocialLinks";

export default async function HomePage() {
  maybeExpireStaleOrders();
  const [settings, products, story, foundation, evening, auction] = await Promise.all([
    getSettings(),
    getActiveProducts(),
    getPage("pribeh"),
    getPage("nadace"),
    getPage("vecer"),
    getPage("drazba"),
  ]);
  const box = products.find((p) => p.type === "BOX");
  const bottles = products.filter((p) => p.type === "BOTTLE");
  const salesOpen = settings.bool("sales.open");
  const foundationUrl = settings.str("foundation.url");

  return (
    <>
      {/* Úvod */}
      <section id="edice" className="relative scroll-mt-20 overflow-hidden border-b border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/box.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/70 to-ink" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-[1fr_auto] md:py-28">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{settings.text("home.hero_kicker")}</p>
            <h1 className="mt-4 font-serif text-5xl font-extrabold uppercase leading-[0.95] tracking-wide text-gold sm:text-7xl">
              {settings.str("home.hero_title")}
            </h1>
            <p className="mt-3 font-serif text-2xl tracking-[0.35em] text-cream sm:text-3xl">
              {settings.str("home.hero_subtitle").toUpperCase()}
            </p>
            {settings
              .text("home.hero_lead")
              .split("\n")
              .filter((line) => line.trim())
              .map((line, i) => (
                <p key={i} className={`${i === 0 ? "mt-6" : "mt-3"} max-w-xl text-lg text-cream/85`}>
                  {line}
                </p>
              ))}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {box && (
                <Link
                  href="/eshop"
                  className="bg-gold px-6 py-3 font-bold uppercase tracking-wider text-ink transition hover:bg-gold-light"
                >
                  Objednat box
                </Link>
              )}
              <Link href="/eshop#lahve" className="border border-gold/70 px-6 py-3 font-semibold text-gold-light hover:bg-gold/10">
                Jednotlivé lahve
              </Link>
            </div>
            {box && (
              <div className="mt-4">
                <StockBadge stock={box.stock} />
              </div>
            )}
          </div>
          <Seal size={220} className="mx-auto hidden opacity-95 md:block" />
        </div>
      </section>

      {/* Čísla edice */}
      <section aria-label="Edice v číslech" className="border-b border-line bg-panel">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-line md:grid-cols-4">
          {[
            ["152", "sběratelských boxů"],
            ["13", "hráčů, 13 lahví v boxu"],
            ["1 976", "lahví celkem"],
            ["50 %", "speciální slivovice"],
          ].map(([value, label]) => (
            <div key={label} className="bg-panel px-4 py-8 text-center">
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-serif text-4xl font-bold text-gold-light">{value}</span>
                <span className="mt-1 block text-sm text-muted">{label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Příběh */}
      {story && (
        <section id="pribeh" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-20 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-serif text-3xl font-bold text-gold sm:text-4xl">{story.title}</h2>
            <Markdown source={story.body} settings={settings} className="mt-6 text-lg" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/lahve.jpg" alt="Třináct lahví edice s portréty hráčů" className="w-full border border-line" />
        </section>
      )}

      {/* Box */}
      {box && (
        <section className="border-y border-line bg-panel">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={box.imageUrl} alt={`${box.name} – vizualizace`} className="w-full border border-line" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Limitovaná edice</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-cream sm:text-4xl">{box.name}</h2>
              <p className="mt-4 text-cream/85">{box.shortDescription}</p>
              <p className="mt-6 font-serif text-4xl font-bold text-gold-light">
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
              <div className="mt-3">
                <StockBadge stock={box.stock} />
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                {salesOpen ? (
                  <Link
                    href="/eshop"
                    className="bg-gold px-6 py-3 font-bold uppercase tracking-wider text-ink transition hover:bg-gold-light"
                  >
                    Do e-shopu
                  </Link>
                ) : (
                  <p className="border border-line p-3 text-sm text-muted">Prodej bude brzy spuštěn.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hráči / kusovky */}
      <section id="hraci" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-bold text-gold sm:text-4xl">Soupiska finále: 13{"\u00a0"}hráčů, 13{"\u00a0"}lahví</h2>
            <p className="mt-2 max-w-2xl text-cream/80">
              Každý hráč finále má vlastní lahev. V{"\u00a0"}boxu je všech 13, lahev svého oblíbeného hráče můžete koupit
              i{"\u00a0"}samostatně za {formatCzk(bottles[0]?.priceCzk ?? 760)}.
            </p>
          </div>
          <Link href="/eshop#lahve" className="text-sm text-gold-light underline underline-offset-4">
            Všechny lahve v e-shopu
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {bottles.map((p) => (
            <PlayerCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Nadace */}
      {foundation && (
        <section id="nadace" className="scroll-mt-20 border-y border-line bg-panel">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center">
            <h2 className="font-serif text-3xl font-bold text-gold sm:text-4xl">{foundation.title}</h2>
            <Markdown source={foundation.body} settings={settings} className="mt-6 text-lg" />
            {foundationUrl && (
              <a
                href={foundationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block border border-gold/70 px-5 py-2 text-sm font-semibold text-gold-light hover:bg-gold/10"
              >
                Web Nadace fotbalových internacionálů
              </a>
            )}
          </div>
        </section>
      )}

      {/* Večer a dražba */}
      <section id="vecer" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-20 md:grid-cols-[2fr_1fr]">
        {evening && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{settings.str("evening.date")}</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-cream sm:text-4xl">{evening.title}</h2>
            <Markdown source={evening.body} settings={settings} className="mt-6 text-lg" />
          </div>
        )}
        {auction && (
          <aside className="self-start border border-seal/70 bg-panel p-6">
            <Seal size={72} />
            <h3 className="mt-4 font-serif text-xl font-bold text-cream">{auction.title}</h3>
            <Markdown source={auction.body} settings={settings} className="mt-3" />
          </aside>
        )}
      </section>

      {/* Kontakt */}
      <section className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 md:flex-row md:items-center">
          <div>
            <h2 className="font-serif text-2xl font-bold text-cream">Máte dotaz?</h2>
            <p className="mt-1 text-muted">
              Napište nám na{" "}
              <a href={`mailto:${settings.str("contact.email")}`} className="text-gold-light underline underline-offset-4">
                {settings.str("contact.email")}
              </a>
              .
            </p>
          </div>
          <SocialLinks settings={settings} />
        </div>
      </section>
    </>
  );
}
