"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { useSyncedPricedCart } from "@/components/cart/usePricedCart";
import { formatCzk } from "@/lib/format";
import { currentConsent, readCookie } from "@/lib/consent";
import { EVENING_ENTRY_NOTE } from "@/lib/labels";
import { Turnstile } from "./Turnstile";
import { PacketaPicker, type PacketaPoint } from "./PacketaPicker";
import { LoadingOverlay, PageLoading } from "@/components/Loading";

type Props = {
  pickupAddress: string;
  pickupNote: string;
  eveningDate: string;
  /** Jak dlouho obvykle trvá ověření platby převodem (payment.verify_time) */
  verifyTime: string;
  /** „Pokud platbu neobdržíme do 7 dní, objednávku zrušíme.“ – jen informace */
  transferCancelNotice: string;
  gopayMinutes: number;
  boxShippingCzk: number;
  /** Platba převodem / QR kódem (nastavení payment.bank_transfer) – teď vypnutá, platí se jen bránou */
  bankTransferEnabled: boolean;
  gopayEnabled: boolean;
  shippingStartNote: string;
  packetaApiKey?: string;
  packetaMock: boolean;
  turnstileSiteKey?: string;
};

type Delivery = "SHIPPING" | "PACKETA" | "PICKUP";
type Payment = "GOPAY" | "BANK_TRANSFER";

const inputCls =
  "mt-1 w-full border border-line bg-ink px-3 py-2.5 text-cream placeholder:text-muted/60 focus:border-gold focus:outline-none aria-[invalid=true]:border-danger";

export function CheckoutForm(props: Props) {
  const { clear } = useCart();
  const { data, loading, ready, notices, inSync, refresh } = useSyncedPricedCart();

  const [delivery, setDelivery] = useState<Delivery>("PACKETA");
  const [packetaPoint, setPacketaPoint] = useState<PacketaPoint | null>(null);
  const [paymentChoice, setPayment] = useState<Payment>(props.gopayEnabled ? "GOPAY" : "BANK_TRANSFER");
  // Vypnutá brána / převod: zbývající způsob platby se zvolí sám
  const payment: Payment = !props.gopayEnabled ? "BANK_TRANSFER" : props.bankTransferEnabled ? paymentChoice : "GOPAY";
  const [company, setCompany] = useState(false);
  const [evening, setEvening] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Objednávka je vytvořená, prohlížeč přechází na platební bránu / stránku objednávky */
  const [redirecting, setRedirecting] = useState<Payment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const onToken = useCallback((t: string | null) => setTurnstileToken(t), []);

  // Nabízí se jen způsoby dostupné pro obsah košíku (box → kurýr, kusovky → Zásilkovna, nad 490 Kč → kurýr)
  const available = (d: Delivery) => !!data && data.shipping[d] !== null && (d !== "PICKUP" || data.pickupEnabled);
  const effectiveDelivery: Delivery = available(delivery)
    ? delivery
    : (["PACKETA", "SHIPPING", "PICKUP"] as const).find(available) ?? delivery;
  const shipping = data ? (data.shipping[effectiveDelivery] ?? 0) : 0;
  const total = data ? data.itemsTotalCzk + shipping : 0;
  const hasBox = useMemo(() => (data?.boxes ?? 0) > 0, [data]);

  if (redirecting) {
    return redirecting === "GOPAY" ? (
      <LoadingOverlay title="Přesměrovávám na platební bránu…" note="Objednávka je vytvořená. Za okamžik se otevře platební brána GoPay – stránku nezavírejte." />
    ) : (
      <LoadingOverlay title="Dokončuji objednávku…" note="Objednávka je vytvořená. Za okamžik uvidíte platební údaje a QR kód." />
    );
  }
  if (!ready || (loading && !data)) return <PageLoading label="Načítám objednávku…" />;
  if (!data || data.lines.length === 0) {
    return (
      <div className="mt-8 border border-line bg-panel p-8 text-center">
        <p>Košík je prázdný.</p>
        <Link href="/eshop" className="mt-4 inline-block text-gold-light underline underline-offset-4">
          Do e-shopu
        </Link>
      </div>
    );
  }
  if (!data.salesOpen) return <p className="mt-8 text-muted">Prodej zatím není spuštěn.</p>;

  const err = (key: string) =>
    fieldErrors[key] ? (
      <p id={`${key}-error`} className="mt-1 text-sm text-danger">
        {fieldErrors[key]}
      </p>
    ) : null;
  const aria = (key: string) => ({
    "aria-invalid": fieldErrors[key] ? true : undefined,
    "aria-describedby": fieldErrors[key] ? `${key}-error` : undefined,
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setFormError(null);
    setFieldErrors({});

    if (!inSync) {
      setFormError("Košík se mezitím změnil – zkontrolujte prosím souhrn objednávky a odešlete ji znovu.");
      return;
    }
    if (effectiveDelivery === "PACKETA" && !packetaPoint) {
      setFieldErrors({ packetaPoint: "Vyberte výdejní místo Zásilkovny." });
      setFormError("Vyberte prosím výdejní místo Zásilkovny.");
      return;
    }
    if (props.turnstileSiteKey && !turnstileToken) {
      setFormError("Počkejte prosím na ověření, že nejste robot.");
      return;
    }

    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const consent = currentConsent();
    const body = {
      lines: data.lines.map((l) => ({ slug: l.slug, quantity: l.quantity })),
      customer: { firstName: s("firstName"), lastName: s("lastName"), email: s("email"), phone: s("phone") },
      deliveryMethod: effectiveDelivery,
      address: effectiveDelivery === "SHIPPING" ? { street: s("street"), city: s("city"), zip: s("zip") } : undefined,
      packetaPoint: effectiveDelivery === "PACKETA" ? (packetaPoint ?? undefined) : undefined,
      billing: company ? { companyName: s("companyName"), ico: s("ico"), dic: s("dic") } : undefined,
      note: s("note") || undefined,
      paymentMethod: payment,
      eveningInterest: hasBox && evening,
      consents: {
        terms: f.get("terms") === "on",
        age: f.get("age") === "on",
        privacy: f.get("privacy") === "on",
        marketing: f.get("marketing") === "on",
      },
      tracking: {
        consent: !!consent?.marketing,
        fbp: consent?.marketing ? readCookie("_fbp") : undefined,
        fbc: consent?.marketing ? readCookie("_fbc") : undefined,
      },
      turnstileToken: turnstileToken ?? undefined,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/objednavka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { redirectUrl?: string; error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok || !json.redirectUrl) {
        setFieldErrors(json.fieldErrors ?? {});
        setFormError(json.error ?? "Objednávku se nepodařilo odeslat.");
        setSubmitting(false);
        refresh(); // ceny a sklad se mohly mezitím změnit
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // Nejdřív překryv, pak vyprázdnit košík – jinak by na okamžik problikl „Košík je prázdný“
      setRedirecting(payment);
      clear();
      window.location.href = json.redirectUrl;
    } catch {
      setFormError("Spojení selhalo. Zkuste to prosím znovu.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-10">
        {formError && (
          <div role="alert" className="border border-danger/70 bg-danger/10 p-4 text-cream">
            {formError}
          </div>
        )}
        {notices.length > 0 && (
          <div role="status" className="border border-warn/60 bg-warn/10 p-4 text-sm text-cream">
            {notices.map((i) => (
              <p key={i.slug}>{i.message}</p>
            ))}
          </div>
        )}

        <fieldset>
          <legend className="font-serif text-2xl font-bold text-gold">Kontaktní údaje</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Jméno *
              <input name="firstName" autoComplete="given-name" required className={inputCls} {...aria("customer.firstName")} />
              {err("customer.firstName")}
            </label>
            <label className="block text-sm">
              Příjmení *
              <input name="lastName" autoComplete="family-name" required className={inputCls} {...aria("customer.lastName")} />
              {err("customer.lastName")}
            </label>
            <label className="block text-sm">
              E-mail *
              <input name="email" type="email" autoComplete="email" required className={inputCls} {...aria("customer.email")} />
              {err("customer.email")}
            </label>
            <label className="block text-sm">
              Telefon *
              <input name="phone" type="tel" autoComplete="tel" required placeholder="+420 777 123 456" className={inputCls} {...aria("customer.phone")} />
              {err("customer.phone")}
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-serif text-2xl font-bold text-gold">Doprava</legend>
          {props.shippingStartNote && <p className="mt-3 border-l-2 border-gold pl-3 text-sm text-cream/90">{props.shippingStartNote}</p>}
          <div className="mt-4 grid gap-3">
            {data.pickupEnabled && (
              <label className={`flex cursor-pointer items-start gap-3 border p-4 ${effectiveDelivery === "PICKUP" ? "border-gold bg-panel" : "border-line"}`}>
                <input type="radio" name="delivery" checked={effectiveDelivery === "PICKUP"} onChange={() => setDelivery("PICKUP")} className="mt-1 accent-[var(--gold)]" />
                <span className="flex-1">
                  <span className="flex justify-between gap-4 font-semibold">
                    Osobní převzetí na FAČR <span className="text-gold-light">zdarma</span>
                  </span>
                  <span className="block text-sm text-muted">
                    {props.pickupAddress}. {props.pickupNote}
                  </span>
                </span>
              </label>
            )}
            {available("PACKETA") && (
              <label className={`flex cursor-pointer items-start gap-3 border p-4 ${effectiveDelivery === "PACKETA" ? "border-gold bg-panel" : "border-line"}`}>
                <input type="radio" name="delivery" checked={effectiveDelivery === "PACKETA"} onChange={() => setDelivery("PACKETA")} className="mt-1 accent-[var(--gold)]" />
                <span className="flex-1">
                  <span className="flex justify-between gap-4 font-semibold">
                    Zásilkovna – výdejní místo <span className="text-gold-light">{formatCzk(data.shipping.PACKETA ?? 0)}</span>
                  </span>
                  <span className="block text-sm text-muted">
                    Cena podle hmotnosti zásilky. Jen výdejní místa s obsluhou (ne Z-BOX) – při vyzvednutí Zásilkovna ověří věk 18+ (doklad totožnosti).
                  </span>
                </span>
              </label>
            )}
            {available("SHIPPING") && (
              <label className={`flex cursor-pointer items-start gap-3 border p-4 ${effectiveDelivery === "SHIPPING" ? "border-gold bg-panel" : "border-line"}`}>
                <input type="radio" name="delivery" checked={effectiveDelivery === "SHIPPING"} onChange={() => setDelivery("SHIPPING")} className="mt-1 accent-[var(--gold)]" />
                <span className="flex-1">
                  <span className="flex justify-between gap-4 font-semibold">
                    Kurýr na adresu v ČR <span className="text-gold-light">{formatCzk(data.shipping.SHIPPING ?? 0)}</span>
                  </span>
                  <span className="block text-sm text-muted">
                    {hasBox
                      ? `${formatCzk(props.boxShippingCzk)} za celou objednávku s boxem. ${data.boxDelivery}`
                      : `${formatCzk(props.boxShippingCzk)} za celou zásilku.`}{" "}
                    Při převzetí může dopravce ověřit věk 18+.
                  </span>
                </span>
              </label>
            )}
          </div>

          {effectiveDelivery === "PACKETA" && (
            <PacketaPicker
              apiKey={props.packetaApiKey}
              mock={props.packetaMock}
              value={packetaPoint}
              onChange={(p) => {
                setPacketaPoint(p);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.packetaPoint;
                  return next;
                });
              }}
              error={fieldErrors["packetaPoint"] ?? fieldErrors["packetaPoint.id"] ?? null}
            />
          )}

          {effectiveDelivery === "SHIPPING" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr]">
              <label className="block text-sm sm:col-span-2">
                Ulice a číslo popisné *
                <input name="street" autoComplete="street-address" className={inputCls} {...aria("address.street")} />
                {err("address.street")}
              </label>
              <label className="block text-sm">
                Město *
                <input name="city" autoComplete="address-level2" className={inputCls} {...aria("address.city")} />
                {err("address.city")}
              </label>
              <label className="block text-sm">
                PSČ *
                <input name="zip" autoComplete="postal-code" inputMode="numeric" placeholder="110 00" className={inputCls} {...aria("address.zip")} />
                {err("address.zip")}
              </label>
              <p className="text-xs text-muted sm:col-span-2">Doručujeme pouze v rámci České republiky.</p>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="font-serif text-2xl font-bold text-gold">Platba</legend>
          <div className="mt-4 grid gap-3">
{props.gopayEnabled && (
                          <label className={`flex cursor-pointer items-start gap-3 border p-4 ${payment === "GOPAY" ? "border-gold bg-panel" : "border-line"}`}>
                <input type="radio" name="payment" checked={payment === "GOPAY"} onChange={() => setPayment("GOPAY")} className="mt-1 accent-[var(--gold)]" />
                <span>
                  <span className="block font-semibold">Online kartou nebo bankovním převodem</span>
                  <span className="block text-sm text-muted">
                    Platební brána GoPay (karta, Apple Pay, Google Pay, rychlý převod). Pokud platbu v bráně nedokončíte do {props.gopayMinutes} minut, zašleme vám platební údaje pro převod / QR kód.
                  </span>
                </span>
              </label>
            )}
            {(props.bankTransferEnabled || !props.gopayEnabled) && (
              <label className={`flex cursor-pointer items-start gap-3 border p-4 ${payment === "BANK_TRANSFER" ? "border-gold bg-panel" : "border-line"}`}>
                <input type="radio" name="payment" checked={payment === "BANK_TRANSFER"} onChange={() => setPayment("BANK_TRANSFER")} className="mt-1 accent-[var(--gold)]" />
                <span>
                  <span className="block font-semibold">Bankovním převodem / QR kódem</span>
                  <span className="block text-sm text-muted">
                    Platební údaje a QR kód uvidíte hned po odeslání objednávky.{props.verifyTime && ` Ověření platby obvykle trvá ${props.verifyTime}.`}
                    {props.transferCancelNotice && ` ${props.transferCancelNotice}`}
                  </span>
                </span>
              </label>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-serif text-2xl font-bold text-gold">Fakturační údaje</legend>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={company} onChange={(e) => setCompany(e.target.checked)} className="accent-[var(--gold)]" />
            Nakupuji na firmu (doplnit IČO a DIČ)
          </label>
          {company && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block text-sm sm:col-span-3">
                Název firmy
                <input name="companyName" autoComplete="organization" className={inputCls} {...aria("billing.companyName")} />
              </label>
              <label className="block text-sm">
                IČO
                <input name="ico" inputMode="numeric" className={inputCls} {...aria("billing.ico")} />
                {err("billing.ico")}
              </label>
              <label className="block text-sm">
                DIČ
                <input name="dic" placeholder="CZ12345678" className={inputCls} {...aria("billing.dic")} />
                {err("billing.dic")}
              </label>
            </div>
          )}
        </fieldset>

        {/* Losování o vstup jen při nákupu boxu (1 vstup na 1 box) */}
        {hasBox && (
          <fieldset className="border border-gold/40 bg-panel p-5">
            <legend className="px-2 font-serif text-xl font-bold text-gold">Galavečer {props.eveningDate}</legend>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={evening} onChange={(e) => setEvening(e.target.checked)} className="mt-1 accent-[var(--gold)]" />
              <span>
                Chci se zúčastnit losování o vstup na galavečer {props.eveningDate}
                <span className="block text-sm text-muted">
                  Do losování zařadíme zaplacené objednávky boxů z předprodeje. {EVENING_ENTRY_NOTE}
                </span>
              </span>
            </label>
          </fieldset>
        )}

        <label className="block text-sm">
          Poznámka k objednávce
          <textarea name="note" rows={3} maxLength={1000} className={inputCls} />
        </label>

        <fieldset className="space-y-3 text-sm">
          <legend className="sr-only">Souhlasy</legend>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="age" required className="mt-1 accent-[var(--gold)]" {...aria("consents.age")} />
            <span>
              Potvrzuji, že je mi <strong>více než 18 let</strong>. *{err("consents.age")}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="terms" required className="mt-1 accent-[var(--gold)]" {...aria("consents.terms")} />
            <span>
              Souhlasím s{" "}
              <Link href="/obchodni-podminky" target="_blank" className="text-gold-light underline underline-offset-4">
                obchodními podmínkami
              </Link>
              . *{err("consents.terms")}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="privacy" required className="mt-1 accent-[var(--gold)]" {...aria("consents.privacy")} />
            <span>
              Seznámil(a) jsem se se{" "}
              <Link href="/ochrana-osobnich-udaju" target="_blank" className="text-gold-light underline underline-offset-4">
                zásadami ochrany osobních údajů
              </Link>
              . *{err("consents.privacy")}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketing" className="mt-1 accent-[var(--gold)]" />
            <span className="text-muted">Chci dostávat novinky o edici a podobných akcích e-mailem (nepovinné).</span>
          </label>
        </fieldset>

        {props.turnstileSiteKey && <Turnstile siteKey={props.turnstileSiteKey} onToken={onToken} />}
      </div>

      <aside className="self-start border border-line bg-panel p-5 lg:sticky lg:top-24">
        <h2 className="font-serif text-xl font-bold text-gold">Souhrn</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {data.lines.map((l) => (
            <li key={l.slug} className="flex justify-between gap-3">
              <span>
                {l.quantity}× {l.name}
              </span>
              <span className="shrink-0">{formatCzk(l.lineTotalCzk)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 text-muted">
            <span>Doprava</span>
            <span>{shipping ? formatCzk(shipping) : "zdarma"}</span>
          </li>
        </ul>
        <p className="mt-4 flex justify-between border-t border-line pt-3 text-lg font-bold">
          <span>Celkem</span>
          <span className="text-gold-light">{formatCzk(total)}</span>
        </p>
        <p className="mt-1 text-xs text-muted">Ceny včetně DPH.</p>
        {data.hasMadeToOrder && <p className="mt-3 text-xs text-cream/80">{data.leadTime}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full bg-gold px-5 py-3 font-bold uppercase tracking-wider text-ink hover:bg-gold-light disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Odesílám…" : payment === "GOPAY" ? "Objednat a zaplatit" : "Objednat s povinností platby"}
        </button>
        {submitting && <LoadingOverlay title="Odesílám objednávku…" note="Ověřujeme sklad a ceny. Chvilku strpení." />}
        <Link href="/kosik" className="mt-3 block text-center text-sm text-muted underline underline-offset-4">
          Upravit košík
        </Link>
        <p className="mt-4 text-xs text-muted">Výtěžek edice jde na podporu Nadace fotbalových internacionálů.</p>
      </aside>
    </form>
  );
}
