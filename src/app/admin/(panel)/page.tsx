import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatCzk, formatDateTime } from "@/lib/format";
import { DELIVERY_LABEL, STATUS_LABEL, statusLabel } from "@/lib/labels";
import { maybeExpireStaleOrders } from "@/lib/orders/expire";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Objednávky" };

const STATUSES: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "COMPLETED", "CANCELLED"];
const PAGE_SIZE = 50;

const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: "border-warn/60 text-warn",
  PAID: "border-ok/60 text-ok",
  SHIPPED: "border-gold/60 text-gold-light",
  COMPLETED: "border-line text-muted",
  CANCELLED: "border-danger/50 text-danger",
};

type Props = { searchParams: Promise<{ stav?: string; q?: string; strana?: string; vecer?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  // Ověření v každé stránce, ne jen v layoutu: layout a stránka se vykreslují souběžně,
  // takže přesměrování z layoutu nezabrání tomu, aby se data stránky dostala do odpovědi.
  await requireAdmin();
  maybeExpireStaleOrders();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.stav as OrderStatus) ? (sp.stav as OrderStatus) : undefined;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.strana) || 1);
  const eveningOnly = sp.vecer === "1";

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(eveningOnly ? { eveningInterest: true } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [orders, total, counts, box, paidAgg] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.product.findFirst({ where: { type: "BOX" }, orderBy: { sortOrder: "asc" } }),
    prisma.order.aggregate({ where: { status: { in: ["PAID", "SHIPPED", "COMPLETED"] } }, _sum: { totalCzk: true }, _count: true }),
  ]);
  const countOf = (s: OrderStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { stav: status, q: q || undefined, vecer: eveningOnly ? "1" : undefined, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-bold text-gold">Objednávky</h1>
        <dl className="flex flex-wrap gap-6 text-sm">
          <div>
            <dt className="text-muted">Boxy skladem</dt>
            <dd className="text-lg font-bold">{box?.stock ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Zaplacené objednávky</dt>
            <dd className="text-lg font-bold">{paidAgg._count}</dd>
          </div>
          <div>
            <dt className="text-muted">Tržby (zaplaceno)</dt>
            <dd className="text-lg font-bold text-gold-light">{formatCzk(paidAgg._sum.totalCzk ?? 0)}</dd>
          </div>
        </dl>
      </div>

      <nav aria-label="Filtr stavu" className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href={link({ stav: undefined, strana: undefined })} className={`border px-3 py-1.5 ${!status ? "border-gold text-gold-light" : "border-line"}`}>
          Vše
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={link({ stav: s, strana: undefined })}
            className={`border px-3 py-1.5 ${status === s ? "border-gold text-gold-light" : "border-line"}`}
          >
            {STATUS_LABEL[s]} <span className="text-muted">({countOf(s)})</span>
          </Link>
        ))}
      </nav>

      <form className="mt-4 flex flex-wrap items-center gap-3" action="/admin">
        {status && <input type="hidden" name="stav" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Číslo, jméno, e-mail, telefon"
          className="w-72 border border-line bg-ink px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="vecer" value="1" defaultChecked={eveningOnly} className="accent-[var(--gold)]" />
          Jen se zájmem o večer
        </label>
        <button className="border border-gold px-4 py-2 text-sm text-gold-light hover:bg-gold hover:text-ink">Hledat</button>
      </form>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-panel text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Číslo</th>
              <th className="px-3 py-2 font-medium">Vytvořeno</th>
              <th className="px-3 py-2 font-medium">Zákazník</th>
              <th className="px-3 py-2 font-medium">Položky</th>
              <th className="px-3 py-2 font-medium">Platba</th>
              <th className="px-3 py-2 font-medium">Doprava</th>
              <th className="px-3 py-2 text-right font-medium">Celkem</th>
              <th className="px-3 py-2 font-medium">Stav</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  Žádné objednávky.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-panel">
                <td className="px-3 py-2">
                  <Link href={`/admin/objednavky/${o.id}`} className="font-semibold text-gold-light underline underline-offset-2">
                    {o.number}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                <td className="px-3 py-2">
                  {o.firstName} {o.lastName}
                  <span className="block text-xs text-muted">{o.email}</span>
                </td>
                <td className="px-3 py-2">
                  {o.items.map((i) => (
                    <span key={i.id} className="block">
                      {i.quantity}× {i.name}
                    </span>
                  ))}
                  {o.eveningInterest && <span className="mt-1 inline-block text-xs text-gold">★ zájem o večer</span>}
                </td>
                <td className="px-3 py-2">{o.paymentMethod === "GOPAY" ? "GoPay" : "Převod"}</td>
                <td className="px-3 py-2">{DELIVERY_LABEL[o.deliveryMethod]}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatCzk(o.totalCzk)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block border px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_STYLE[o.status]}`}>
                    {statusLabel(o.status, o.deliveryMethod)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Stránkování" className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={link({ strana: String(page - 1) })} className="border border-line px-3 py-1.5">
              ← Předchozí
            </Link>
          )}
          <span className="text-muted">
            Strana {page} z {pages} ({total} objednávek)
          </span>
          {page < pages && (
            <Link href={link({ strana: String(page + 1) })} className="border border-line px-3 py-1.5">
              Další →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
