import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatCzk, formatDateTime, formatDuration } from "@/lib/format";
import { formatIban, transferInstructions } from "@/lib/bank";
import { DELIVERY_LABEL } from "@/lib/labels";
import { AutoClose } from "./AutoClose";

export const metadata: Metadata = { title: "Ověření platby", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Ověření platby převodem z odkazu v ověřovacím e-mailu (SPECIFIKACE 5b). Bez přihlášení – přístup jen
 * s tajným tokenem objednávky. Samotné otevření nic nemění, rozhoduje tlačítko (POST).
 */
type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ akce?: string; hotovo?: string; stav?: string }>;
};

const ACTIONS = [
  { key: "paid", akce: "zaplaceno", label: "Zaplaceno", note: "Platba je na účtu. Zákazník dostane potvrzení platby s PDF.", primary: true },
  { key: "remind", akce: "upominka", label: "Nezaplaceno – poslat upomínku", note: "Zákazníkovi odejde upomínka s QR kódem. Ověřování běží dál.", primary: false },
  { key: "manual", akce: "vyresim", label: "Nezaplaceno – vyřeším sám", note: "Připomínání skončí, objednávku dál řešíte v administraci.", primary: false },
] as const;

const DONE: Record<string, string> = {
  paid: "Hotovo – objednávka je označená jako zaplacená a zákazník dostal potvrzení platby.",
  remind: "Hotovo – zákazníkovi odešla upomínka. Ověřovací e-mail vám přijde znovu za 24 hodin.",
  manual: "Hotovo – připomínání skončilo. Objednávku řešíte v administraci.",
};

/** Konečná obrazovka (rozhodnuto / odkaz už neplatí): zkusí zavřít okno, jinak přesměruje na úvod. */
function Finished({ title, text, tone }: { title: string; text: string; tone: "ok" | "info" | "error" }) {
  const border = tone === "ok" ? "border-ok/50 bg-ok/10" : tone === "error" ? "border-danger/50 bg-danger/10" : "border-line bg-panel";
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center bg-ink px-4 py-10 text-cream">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Ověření platby převodem</p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-gold">{title}</h1>
      <p className={`mt-6 border p-4 text-sm ${border}`} role="status">
        {text}
      </p>
      <p className="mt-4 text-sm text-muted">
        Okno se za okamžik zavře, případně budete přesměrováni na úvod.{" "}
        <Link href="/" className="text-gold-light underline underline-offset-4">
          Přejít na úvod
        </Link>
      </p>
      <AutoClose />
    </main>
  );
}

export default async function VerifyPaymentPage({ params, searchParams }: Props) {
  const [{ token }, { akce, hotovo, stav }] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const order = await prisma.order.findUnique({ where: { verifyToken: token }, include: { items: true } });

  // Odkaz je jednorázový: po rozhodnutí (nebo když přišel novější ověřovací e-mail) už k objednávce nevede
  if (!order || order.paymentMethod !== "BANK_TRANSFER" || order.anonymizedAt) {
    if (hotovo && DONE[hotovo]) return <Finished title="Hotovo" text={DONE[hotovo]} tone="ok" />;
    if (stav === "chyba") {
      return (
        <Finished
          title="Akce se nezdařila"
          text="Akci se nepodařilo dokončit. Objednávku prosím vyřešte v administraci."
          tone="error"
        />
      );
    }
    return (
      <Finished
        title="Odkaz už neplatí"
        text="Tento odkaz už byl použit, nebo k objednávce přišel novější ověřovací e-mail. Odkazy jsou jednorázové – po prvním rozhodnutí přestanou platit všechny."
        tone="info"
      />
    );
  }

  const settings = await getSettings();
  const t = transferInstructions(settings.str("bank.account"), order.totalCzk, order.number, settings.str("seller.name"));
  const open = order.status === "PENDING";
  const paid = order.status === "PAID" || order.status === "SHIPPED" || order.status === "COMPLETED";

  const rows: [string, string][] = [
    ["Objednáno", formatDateTime(order.createdAt)],
    ["Zákazník", `${order.firstName} ${order.lastName}`],
    ["E-mail / telefon", `${order.email} · ${order.phone}`],
    ["Doprava", DELIVERY_LABEL[order.deliveryMethod]],
  ];
  if (order.reminderCount > 0) rows.push(["Upomínky", `${order.reminderCount}× (poslední ${formatDateTime(order.reminderSentAt)})`]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl overflow-x-hidden bg-ink px-4 py-10 text-cream">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Ověření platby převodem</p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-gold">Objednávka {order.number}</h1>

      {hotovo && DONE[hotovo] && (
        <p className="mt-6 border border-ok/50 bg-ok/10 p-4 text-sm" role="status">
          {DONE[hotovo]}
        </p>
      )}
      {stav === "chyba" && (
        <p className="mt-6 border border-danger/50 bg-danger/10 p-4 text-sm" role="alert">
          Akci se nepodařilo provést. Zkuste to prosím znovu, případně objednávku vyřešte v administraci.
        </p>
      )}
      {!hotovo && paid && <p className="mt-6 border border-line p-4 text-sm">Objednávka je už zaplacená, není co ověřovat.</p>}
      {!hotovo && order.status === "CANCELLED" && <p className="mt-6 border border-line p-4 text-sm">Objednávka byla zrušena.</p>}

      <section className="mt-6 border border-line border-t-2 border-t-gold bg-panel p-5">
        <p className="text-sm text-muted">V internetovém bankovnictví vyhledejte příchozí platbu:</p>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 [overflow-wrap:anywhere]">
          <dt className="text-muted">Variabilní symbol</dt>
          <dd className="font-serif text-2xl text-gold-light">{t.variableSymbol}</dd>
          <dt className="text-muted">Částka</dt>
          <dd className="font-serif text-2xl text-gold-light">{formatCzk(t.amountCzk)}</dd>
          <dt className="text-muted">Na účet</dt>
          <dd>{t.account}</dd>
          <dt className="text-muted">IBAN</dt>
          <dd className="text-sm">{formatIban(t.iban)}</dd>
        </dl>
      </section>

      {open && (
        <section className="mt-6 space-y-3">
          {order.verifyState === "MANUAL" && (
            <p className="text-sm text-muted">Stav: Nezaplaceno – řešíte sami ({formatDuration(order.stateChangedAt)}).</p>
          )}
          {ACTIONS.map((a) => {
            const selected = akce === a.akce;
            return (
              <form key={a.key} method="post" action={`/api/overeni-platby/${token}`}>
                <input type="hidden" name="action" value={a.key} />
                <button
                  className={`w-full px-5 py-3 text-sm font-bold uppercase tracking-wider transition ${
                    a.primary ? "bg-gold text-ink hover:bg-gold-light" : "border border-gold/70 text-gold-light hover:bg-gold/10"
                  } ${selected ? "ring-2 ring-gold-light ring-offset-2 ring-offset-ink" : ""}`}
                >
                  {selected ? `Potvrdit: ${a.label}` : a.label}
                </button>
                <p className="mt-1 text-xs text-muted">{a.note}</p>
              </form>
            );
          })}
          <p className="pt-2 text-xs text-muted">
            Odkazy jsou jednorázové – po rozhodnutí přestanou platit všechny odkazy z ověřovacího e-mailu. Úplné zrušení
            objednávky (uvolnění boxu) jen v administraci po přihlášení.
          </p>
        </section>
      )}

      <section className="mt-8">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm [overflow-wrap:anywhere]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-2">
              <span className="min-w-0">
                {i.quantity}× {i.name}
              </span>
              <span className="whitespace-nowrap">{formatCzk(i.unitPriceCzk * i.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 py-2 text-muted">
            <span>Doprava</span>
            <span>{order.shippingCzk ? formatCzk(order.shippingCzk) : "zdarma"}</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
