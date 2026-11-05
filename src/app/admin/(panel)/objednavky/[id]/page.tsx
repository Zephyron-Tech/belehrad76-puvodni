import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatCzk, formatDateTime, formatZip } from "@/lib/format";
import { DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL, statusLabel } from "@/lib/labels";
import { ADMIN_TRANSITIONS } from "@/lib/orders/transitions";
import { StatusActions, NoteForm, AnonymizeForm, PacketaForm } from "./OrderForms";
import { env } from "@/lib/env";
import { packetDraft } from "@/lib/packeta";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Detail objednávky" };

const ACTION_LABEL: Record<string, string> = {
  order_created: "Objednávka vytvořena",
  status_change: "Změna stavu",
  internal_note: "Interní poznámka upravena",
  anonymize: "Osobní údaje anonymizovány",
  payment_refunded: "Platba vrácena (GoPay)",
  duplicate_payment: "⚠ Druhá platba stejné objednávky (GoPay) – vrátit",
  packeta_created: "Zásilka založena v Zásilkovně",
};
const SOURCE_LABEL: Record<string, string> = { system: "systém", gopay: "GoPay", admin: "administrace", customer: "zákazník" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Ověření v každé stránce, ne jen v layoutu: layout a stránka se vykreslují souběžně,
  // takže přesměrování z layoutu nezabrání tomu, aby se data stránky dostala do odpovědi.
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: { orderBy: { createdAt: "desc" } }, audit: { orderBy: { createdAt: "desc" } } },
    }),
    getSettings(),
  ]);
  if (!order) notFound();

  const transitions = ADMIN_TRANSITIONS[order.status];

  return (
    <div>
      <Link href="/admin" className="text-sm text-muted hover:text-gold-light">
        ← Objednávky
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <h1 className="font-serif text-3xl font-bold text-gold">Objednávka {order.number}</h1>
        <span className="border border-gold/60 px-3 py-1 text-sm text-gold-light">{statusLabel(order.status, order.deliveryMethod)}</span>
        {order.anonymizedAt && <span className="border border-line px-3 py-1 text-sm text-muted">anonymizováno</span>}
      </div>
      <p className="mt-1 text-sm text-muted">
        Vytvořeno {formatDateTime(order.createdAt)}
        {order.paidAt && ` · zaplaceno ${formatDateTime(order.paidAt)}`}
        {order.shippedAt && ` · odesláno ${formatDateTime(order.shippedAt)}`}
        {order.status === "PENDING" && order.reservedUntil && ` · rezervace do ${formatDateTime(order.reservedUntil)}`}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="border border-line bg-panel p-5">
            <h2 className="font-serif text-lg font-bold text-gold">Zboží</h2>
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-line">
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2">
                      {i.name}
                      {i.madeToOrder && <span className="ml-2 text-xs text-warn">vyrábí se na objednávku</span>}
                    </td>
                    <td className="py-2 text-center">{i.quantity}×</td>
                    <td className="py-2 text-right">{formatCzk(i.unitPriceCzk)}</td>
                    <td className="py-2 text-right">{formatCzk(i.unitPriceCzk * i.quantity)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 text-muted" colSpan={3}>
                    Doprava – {DELIVERY_LABEL[order.deliveryMethod]}
                  </td>
                  <td className="py-2 text-right">{order.shippingCzk ? formatCzk(order.shippingCzk) : "zdarma"}</td>
                </tr>
                <tr className="font-bold">
                  <td className="py-2" colSpan={3}>
                    Celkem
                  </td>
                  <td className="py-2 text-right text-gold-light">{formatCzk(order.totalCzk)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="grid gap-6 border border-line bg-panel p-5 sm:grid-cols-2">
            <div>
              <h2 className="font-serif text-lg font-bold text-gold">Zákazník</h2>
              <p className="mt-2 text-sm">
                {order.firstName} {order.lastName}
                <br />
                <a href={`mailto:${order.email}`} className="text-gold-light underline">
                  {order.email}
                </a>
                <br />
                <a href={`tel:${order.phone.replace(/\s/g, "")}`}>{order.phone}</a>
              </p>
              {(order.companyName || order.ico || order.dic) && (
                <p className="mt-3 text-sm">
                  <span className="text-muted">Fakturace:</span> {order.companyName}
                  {order.ico && <span className="block">IČO {order.ico}</span>}
                  {order.dic && <span className="block">DIČ {order.dic}</span>}
                </p>
              )}
              <p className="mt-3 text-xs text-muted">Marketingový souhlas: {order.marketingConsent ? "ano" : "ne"}</p>
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-gold">Doručení</h2>
              <p className="mt-2 text-sm">
                {order.deliveryMethod === "PICKUP" ? (
                  <>
                    Osobní převzetí: {settings.str("pickup.address")}
                  </>
                ) : order.deliveryMethod === "PACKETA" ? (
                  <>
                    Zásilkovna – výdejní místo
                    <br />
                    <strong>{order.packetaPointName}</strong>
                    <br />
                    {order.packetaPointAddress}
                    <br />
                    <span className="text-muted">ID místa: {order.packetaPointId}</span>
                  </>
                ) : (
                  <>
                    {order.street}
                    <br />
                    {formatZip(order.zip)} {order.city}
                    <br />
                    {order.country}
                  </>
                )}
              </p>
              {order.carrier && (
                <p className="mt-2 text-sm">
                  <span className="text-muted">Dopravce:</span> {order.carrier}
                  {order.trackingNumber && <span className="block">Číslo zásilky: {order.trackingNumber}</span>}
                </p>
              )}
              <p className="mt-3 text-sm">
                <span className="text-muted">Platba:</span> {PAYMENT_LABEL[order.paymentMethod]}
                <br />
                <span className="text-muted">VS:</span> {order.number}
              </p>
            </div>
            <div className="sm:col-span-2">
              <h2 className="font-serif text-lg font-bold text-gold">Slavnostní večer</h2>
              <p className="mt-2 text-sm">
                {order.eveningInterest ? (
                  <strong className="text-gold-light">Má zájem o losování</strong>
                ) : (
                  "Bez zájmu"
                )}
              </p>
            </div>
            {order.note && (
              <div className="sm:col-span-2">
                <h2 className="font-serif text-lg font-bold text-gold">Poznámka zákazníka</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm">{order.note}</p>
              </div>
            )}
          </section>

          {order.payments.length > 0 && (
            <section className="border border-line bg-panel p-5">
              <h2 className="font-serif text-lg font-bold text-gold">Platby GoPay</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id}>
                    {formatDateTime(p.createdAt)} · ID {p.gopayId} · {formatCzk(p.amountCzk)} ·{" "}
                    <strong>{p.state}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="border border-line bg-panel p-5">
            <h2 className="font-serif text-lg font-bold text-gold">Historie změn</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {order.audit.map((a) => (
                <li key={a.id} className="border-l-2 border-line pl-3">
                  <span className="text-muted">{formatDateTime(a.createdAt)}</span> · {ACTION_LABEL[a.action] ?? a.action}
                  {a.fromStatus && a.toStatus && (
                    <>
                      : {STATUS_LABEL[a.fromStatus]} → <strong>{STATUS_LABEL[a.toStatus]}</strong>
                    </>
                  )}
                  {!a.fromStatus && a.toStatus && (
                    <>
                      : <strong>{STATUS_LABEL[a.toStatus]}</strong>
                    </>
                  )}
                  <span className="block text-xs text-muted">
                    {SOURCE_LABEL[a.source] ?? a.source}
                    {a.actor && ` · ${a.actor}`}
                    {a.ip && ` · IP ${a.ip}`}
                    {a.detail && ` · ${a.detail}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          {order.deliveryMethod === "PACKETA" && !order.anonymizedAt && order.status !== "CANCELLED" && (
            <PacketaForm
              orderId={order.id}
              canCreate={order.status === "PAID"}
              apiReady={!!env.packetaApiPassword}
              barcodes={order.packetaBarcodes}
              draft={packetDraft(order, settings)}
            />
          )}
          <StatusActions
            orderId={order.id}
            transitions={transitions}
            deliveryMethod={order.deliveryMethod}
            paymentMethod={order.paymentMethod}
            status={order.status}
            packetaBarcodes={order.packetaBarcodes}
          />
          <NoteForm orderId={order.id} note={order.internalNote ?? ""} />
          {!order.anonymizedAt && (order.status === "COMPLETED" || order.status === "CANCELLED") && <AnonymizeForm orderId={order.id} />}
        </aside>
      </div>
    </div>
  );
}
