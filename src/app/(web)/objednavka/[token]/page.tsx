import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatCzk, formatDateTime, formatZip } from "@/lib/format";
import { formatIban, qrDataUrl, transferInstructions } from "@/lib/bank";
import { DELIVERY_LABEL, EVENING_ENTRY_NOTE, PAYMENT_LABEL, statusLabel, transferCancelNotice } from "@/lib/labels";
import { syncOrderPayments } from "@/lib/orders/payments";
import { purchaseEventId } from "@/lib/meta-capi";
import { env } from "@/lib/env";
import { PayButton } from "./PayButton";
import { PurchaseTracker } from "./PurchaseTracker";

export const metadata: Metadata = { title: "Objednávka", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ platba?: string }>;
};

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ token }, { platba }] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();

  let order = await prisma.order.findUnique({ where: { publicToken: token }, include: { items: true } });
  if (!order) notFound();

  // Návrat z platební brány: stav ověříme přímo v GoPay
  if (platba === "navrat" && order.status === "PENDING" && order.paymentMethod === "GOPAY") {
    await syncOrderPayments(order.id);
    order = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  }

  const settings = await getSettings();
  const isPaid = order.status === "PAID" || order.status === "SHIPPED" || order.status === "COMPLETED";
  const isPending = order.status === "PENDING";
  // Převod nemá lhůtu (čeká na ověřovatele, SPECIFIKACE 5b) – „vypršelo“ jen u GoPay
  const expired = order.paymentMethod === "GOPAY" && !!order.reservedUntil && order.reservedUntil < new Date();
  const verifyTime = settings.str("payment.verify_time");
  // Jen informace – automaticky se nic neruší; po upomínce se počítá od upomínky
  const cancelNotice = transferCancelNotice(settings.num("reservation.transfer_days"), order.reminderSentAt ?? order.createdAt);

  const transfer =
    isPending && order.paymentMethod === "BANK_TRANSFER"
      ? transferInstructions(settings.str("bank.account"), order.totalCzk, order.number, settings.str("seller.name"))
      : null;
  const qr = transfer ? await qrDataUrl(transfer.spd) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted">Objednávka č. {order.number}</p>

      {isPaid && (
        <>
          <h1 className="mt-1 font-serif text-4xl font-bold text-gold">Děkujeme, platba je přijata</h1>
          <p className="mt-4 text-lg text-cream/85">
            Potvrzení o zaplacení jsme poslali na <strong className="text-cream">{order.email}</strong>. Výtěžek edice jde na podporu
            Nadace fotbalových internacionálů.
          </p>
          <PurchaseTracker
            orderNumber={order.number}
            value={order.totalCzk}
            eventId={purchaseEventId(order.number)}
            items={order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.unitPriceCzk }))}
          />
        </>
      )}

      {isPending && order.paymentMethod === "GOPAY" && (
        <>
          <h1 className="mt-1 font-serif text-4xl font-bold text-gold">Objednávka čeká na zaplacení</h1>
          {platba === "navrat" && <p className="mt-4 text-cream/85">Platba zatím nebyla dokončena nebo byla zrušena.</p>}
          {platba === "chyba" && (
            <p className="mt-4 text-warn">Platební bránu se nepodařilo otevřít. Objednávka je uložena, zkuste platbu spustit znovu.</p>
          )}
          {expired ? (
            <p className="mt-4 text-cream/85">Čas na zaplacení vypršel. Objednávka bude zrušena.</p>
          ) : (
            <div className="mt-6 max-w-sm">
              <PayButton token={order.publicToken} />
              <p className="mt-2 text-sm text-muted">Zboží pro vás držíme do {formatDateTime(order.reservedUntil)}.</p>
            </div>
          )}
        </>
      )}

      {isPending && transfer && (
        <>
          <h1 className="mt-1 font-serif text-4xl font-bold text-gold">Objednávka přijata</h1>
          <p className="mt-4 text-lg text-cream/85">
            Platbu prosím odešlete na uvedený účet, nebo naskenujte QR kód v aplikaci své banky. Platební údaje jsme zaslali
            také na <strong className="text-cream">{order.email}</strong>.
          </p>
          <div className="mt-8 grid gap-6 border border-gold/50 bg-panel p-6 sm:grid-cols-[1fr_auto]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted">Číslo účtu</dt>
              <dd className="font-semibold text-cream">{transfer.account}</dd>
              <dt className="text-muted">IBAN</dt>
              <dd className="text-cream">{formatIban(transfer.iban)}</dd>
              <dt className="text-muted">Variabilní symbol</dt>
              <dd className="font-semibold text-cream">{transfer.variableSymbol}</dd>
              <dt className="text-muted">Částka</dt>
              <dd className="font-semibold text-gold-light">{formatCzk(transfer.amountCzk)}</dd>
            </dl>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR kód pro platbu" width={180} height={180} className="mx-auto bg-white p-1" />
            )}
          </div>
          <div className="mt-6 space-y-1 text-sm text-muted">
            {verifyTime && <p>Ověření platby obvykle trvá {verifyTime}. Jakmile platbu přijmeme, zašleme vám potvrzení.</p>}
            {cancelNotice && <p>{cancelNotice}</p>}
          </div>
          <div className="mt-8 max-w-sm">
            <Link
              href="/"
              className="block w-full bg-gold px-6 py-3 text-center font-bold uppercase tracking-wider text-ink transition hover:bg-gold-light"
            >
              Přejít na úvod
            </Link>
            <p className="mt-2 text-sm text-muted">Po zaplacení přejděte na úvod.</p>
          </div>
        </>
      )}

      {order.status === "CANCELLED" && (
        <>
          <h1 className="mt-1 font-serif text-4xl font-bold text-cream">Objednávka byla zrušena</h1>
          <p className="mt-4 text-cream/85">
            Pokud jste již zaplatili, ozvěte se nám prosím na{" "}
            <a href={`mailto:${settings.str("contact.email")}`} className="text-gold-light underline">
              {settings.str("contact.email")}
            </a>
            .
          </p>
        </>
      )}

      <section className="mt-10 border border-line bg-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-bold text-gold">Shrnutí objednávky</h2>
          <span className="border border-line px-2 py-1 text-xs text-cream">{statusLabel(order.status, order.deliveryMethod)}</span>
        </div>
        <ul className="mt-4 divide-y divide-line text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                {i.quantity}× {i.name}
                {i.madeToOrder && <span className="block text-xs text-muted">vyrábí se na objednávku</span>}
              </span>
              <span>{formatCzk(i.unitPriceCzk * i.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 py-2 text-muted">
            <span>Doprava – {DELIVERY_LABEL[order.deliveryMethod]}</span>
            <span>{order.shippingCzk ? formatCzk(order.shippingCzk) : "zdarma"}</span>
          </li>
          <li className="flex justify-between gap-3 py-2 text-base font-bold">
            <span>Celkem</span>
            <span className="text-gold-light">{formatCzk(order.totalCzk)}</span>
          </li>
        </ul>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Platba</dt>
            <dd>{PAYMENT_LABEL[order.paymentMethod]}</dd>
          </div>
          <div>
            <dt className="text-muted">Doručení</dt>
            <dd>
              {order.deliveryMethod === "PICKUP" ? (
                <>
                  {settings.str("pickup.address")}
                  <span className="block text-xs text-muted">{settings.text("pickup.note")}</span>
                </>
              ) : order.deliveryMethod === "PACKETA" ? (
                <>
                  Zásilkovna: {order.packetaPointName}
                  {order.packetaPointAddress && <span className="block text-xs text-muted">{order.packetaPointAddress}</span>}
                </>
              ) : (
                <>
                  {order.street}, {formatZip(order.zip)} {order.city}
                </>
              )}
            </dd>
          </div>
          {order.trackingNumber && (
            <div>
              <dt className="text-muted">Zásilka</dt>
              <dd>
                {order.carrier}: {order.trackingNumber}
              </dd>
            </div>
          )}
          {order.eveningInterest && (
            <div>
              <dt className="text-muted">Slavnostní večer</dt>
              <dd>
                Zájem o losování o vstup
                <span className="block text-sm text-muted">{EVENING_ENTRY_NOTE}</span>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {env.gopayMode === "mock" && isPending && order.paymentMethod === "GOPAY" && (
        <p className="mt-6 text-xs text-warn">Vývojový režim: platby jsou simulované (GOPAY_MODE=mock).</p>
      )}

      <p className="mt-8">
        <Link href="/" className="text-gold-light underline underline-offset-4">
          Zpět na úvod
        </Link>
      </p>
    </div>
  );
}
