"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { DeliveryMethod, OrderStatus, PaymentMethod } from "@prisma/client";
import type { PacketDraft } from "@/lib/packeta";
import { anonymizeAction, changeStatusAction, createPacketsAction, saveNoteAction, type ActionState } from "../../../actions";

const inputCls = "mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none";

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`mt-3 text-sm ${state.error ? "text-danger" : "text-ok"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

/** Jméno / iniciály – účet je společný, ať je v historii vidět, kdo změnu udělal. */
function ActorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      Vaše jméno nebo iniciály (nepovinné, pro historii)
      <input name="actor" value={value} onChange={(e) => onChange(e.target.value)} maxLength={40} className={inputCls} />
    </label>
  );
}

export function StatusActions(props: {
  orderId: number;
  status: OrderStatus;
  transitions: OrderStatus[];
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  /** Čárové kódy zásilek založených přes API Zásilkovny – předvyplní číslo zásilky */
  packetaBarcodes?: string[];
}) {
  const [state, action, pending] = useActionState(changeStatusAction, undefined);
  const [actor, setActor] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const isPickup = props.deliveryMethod === "PICKUP";
  const isPacketa = props.deliveryMethod === "PACKETA";

  if (props.transitions.length === 0) {
    return (
      <section className="border border-line bg-panel p-5">
        <h2 className="font-serif text-lg font-bold text-gold">Stav</h2>
        <p className="mt-2 text-sm text-muted">Objednávka je uzavřená, další změny stavu nejsou možné.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 border border-gold/50 bg-panel p-5">
      <h2 className="font-serif text-lg font-bold text-gold">Změnit stav</h2>
      <ActorField value={actor} onChange={setActor} />

      {props.transitions.includes("PAID") && (
        <form action={action} className="border-t border-line pt-4">
          <input type="hidden" name="orderId" value={props.orderId} />
          <input type="hidden" name="to" value="PAID" />
          <input type="hidden" name="actor" value={actor} />
          <p className="text-sm text-muted">
            {props.status === "CANCELLED"
              ? "Platba dorazila po zrušení objednávky. Box se znovu odečte ze skladu, pokud je k dispozici."
              : props.paymentMethod === "BANK_TRANSFER"
                ? "Po připsání platby na účet (zkontrolujte VS a částku)."
                : "Platba přes GoPay se označí automaticky. Ručně jen ve výjimečných případech."}
          </p>
          <button disabled={pending} className="mt-2 w-full bg-ok px-4 py-2 text-sm font-bold text-ink disabled:opacity-60">
            Platba přijata → Zaplacená
          </button>
          <p className="mt-1 text-xs text-muted">Zákazníkovi odejde potvrzení platby s PDF.</p>
        </form>
      )}

      {props.transitions.includes("SHIPPED") && (
        <form action={action} className="space-y-2 border-t border-line pt-4">
          <input type="hidden" name="orderId" value={props.orderId} />
          <input type="hidden" name="to" value="SHIPPED" />
          <input type="hidden" name="actor" value={actor} />
          {isPickup ? (
            <p className="text-sm text-muted">Zákazník dostane e-mail, že objednávka je připravena k převzetí na FAČR.</p>
          ) : isPacketa ? (
            <>
              <input type="hidden" name="carrier" value="Zásilkovna" />
              <label className="block text-sm">
                Číslo zásilky Zásilkovny
                <input
                  name="trackingNumber"
                  defaultValue={props.packetaBarcodes?.join(", ")}
                  key={props.packetaBarcodes?.join(",")}
                  className={inputCls}
                  placeholder="Z1234567890"
                />
              </label>
              <p className="text-xs text-muted">
                Nejdřív založte zásilku v bloku Zásilkovna níže (nebo ručně v klientské sekci s ověřením věku 18+), pak ji podejte na
                podacím místě a označte jako odeslanou.
              </p>
            </>
          ) : (
            <>
              <label className="block text-sm">
                Dopravce *
                <input name="carrier" required className={inputCls} placeholder="např. PPL, DPD, Česká pošta" />
              </label>
              <label className="block text-sm">
                Číslo zásilky
                <input name="trackingNumber" className={inputCls} />
              </label>
            </>
          )}
          <button disabled={pending} className="w-full bg-gold px-4 py-2 text-sm font-bold text-ink hover:bg-gold-light disabled:opacity-60">
            {isPickup ? "Připraveno k převzetí" : "Odesláno → poslat e-mail zákazníkovi"}
          </button>
        </form>
      )}

      {props.transitions.includes("COMPLETED") && (
        <form action={action} className="border-t border-line pt-4">
          <input type="hidden" name="orderId" value={props.orderId} />
          <input type="hidden" name="to" value="COMPLETED" />
          <input type="hidden" name="actor" value={actor} />
          <button disabled={pending} className="w-full border border-gold px-4 py-2 text-sm font-semibold text-gold-light disabled:opacity-60">
            {isPickup ? "Předáno zákazníkovi → Dokončená" : "Doručeno → Dokončená"}
          </button>
        </form>
      )}

      {props.transitions.includes("CANCELLED") && (
        <form action={action} className="border-t border-line pt-4">
          <input type="hidden" name="orderId" value={props.orderId} />
          <input type="hidden" name="to" value="CANCELLED" />
          <input type="hidden" name="actor" value={actor} />
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" checked={confirmCancel} onChange={(e) => setConfirmCancel(e.target.checked)} className="mt-1" />
            <span>
              Opravdu zrušit? Box se vrátí na sklad.
              {props.status === "PAID" && " Peníze je nutné vrátit ručně (GoPay / převodem)."}
            </span>
          </label>
          <button
            disabled={pending || !confirmCancel}
            className="mt-2 w-full border border-danger/70 px-4 py-2 text-sm text-danger disabled:opacity-40"
          >
            Zrušit objednávku
          </button>
        </form>
      )}

      <Feedback state={state} />
    </section>
  );
}

export function NoteForm({ orderId, note }: { orderId: number; note: string }) {
  const [state, action, pending] = useActionState(saveNoteAction, undefined);
  return (
    <form action={action} className="border border-line bg-panel p-5">
      <h2 className="font-serif text-lg font-bold text-gold">Interní poznámka</h2>
      <input type="hidden" name="orderId" value={orderId} />
      <textarea name="internalNote" defaultValue={note} rows={4} maxLength={4000} className={inputCls} />
      <label className="mt-2 block text-xs text-muted">
        Jméno / iniciály
        <input name="actor" maxLength={40} className={inputCls} />
      </label>
      <button disabled={pending} className="mt-3 border border-line px-4 py-2 text-sm hover:border-gold disabled:opacity-60">
        Uložit poznámku
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function AnonymizeForm({ orderId }: { orderId: number }) {
  const [state, action, pending] = useActionState(anonymizeAction, undefined);
  return (
    <form action={action} className="border border-line bg-panel p-5">
      <h2 className="font-serif text-lg font-bold text-gold">GDPR – anonymizace</h2>
      <p className="mt-2 text-xs text-muted">
        Nevratně nahradí osobní údaje zákazníka (jméno, kontakt, adresa, poznámky). Položky a částky zůstanou. Používejte na žádost
        zákazníka nebo po uplynutí doby uchování – pozor na povinnosti pro účetnictví.
      </p>
      <input type="hidden" name="orderId" value={orderId} />
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" /> Rozumím, anonymizovat
      </label>
      <label className="mt-2 block text-xs text-muted">
        Jméno / iniciály
        <input name="actor" maxLength={40} className={inputCls} />
      </label>
      <button disabled={pending} className="mt-3 border border-danger/70 px-4 py-2 text-sm text-danger disabled:opacity-60">
        Anonymizovat
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Zásilkovna: shrnutí zásilky s možností úprav, založení přes API a štítek k tisku. */
export function PacketaForm(props: {
  orderId: number;
  canCreate: boolean;
  apiReady: boolean;
  barcodes: string[];
  draft: PacketDraft;
}) {
  const [state, action, pending] = useActionState(createPacketsAction, undefined);
  const [adult, setAdult] = useState(props.draft.adultContent);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { draft } = props;

  // Po úspěšném založení dialog zavřít (výsledek se ukáže v bloku Zásilkovna)
  useEffect(() => {
    if (state?.ok) dialogRef.current?.close();
  }, [state]);
  const missing = draft.parcels.length;
  const smallCls = "mt-1 w-full border border-line bg-ink px-2 py-1.5 text-sm text-cream focus:border-gold focus:outline-none";

  return (
    <section className="border border-line bg-panel p-5">
      <h2 className="font-serif text-lg font-bold text-gold">Zásilkovna</h2>
      {props.barcodes.length > 0 && (
        <>
          <ul className="mt-2 space-y-1 text-sm">
            {props.barcodes.map((b) => (
              <li key={b}>
                <a
                  href={`https://tracking.packeta.com/cs/?id=${encodeURIComponent(b)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-gold-light underline underline-offset-2"
                >
                  {b}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={`/admin/zasilkovna/stitek/${props.orderId}`}
            className="mt-3 inline-block border border-gold px-4 py-2 text-sm font-semibold text-gold-light hover:bg-gold hover:text-ink"
          >
            Stáhnout štítek{props.barcodes.length > 1 ? "y" : ""} (PDF)
          </a>
        </>
      )}
      {missing > 0 &&
        (!props.apiReady ? (
          <p className="mt-2 text-sm text-muted">
            API Zásilkovny není nastavené (PACKETA_API_PASSWORD). Zásilku založte ručně v klientské sekci – s ID výdejního místa a
            ověřením věku 18+.
          </p>
        ) : !props.canCreate ? (
          <p className="mt-2 text-sm text-muted">Zásilku lze založit, až bude objednávka zaplacená.</p>
        ) : (
          <>
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="mt-3 w-full bg-gold px-4 py-2 text-sm font-bold text-ink hover:bg-gold-light"
          >
            {props.barcodes.length > 0 ? "Založit zbývající zásilky…" : "Založit zásilku…"}
          </button>
          <dialog
            ref={dialogRef}
            aria-labelledby={`packeta-dialog-${props.orderId}`}
            className="m-auto w-[min(36rem,calc(100vw-2rem))] border border-gold/50 bg-panel p-0 text-cream backdrop:bg-black/70"
          >
          <form action={action} className="max-h-[85vh] space-y-4 overflow-y-auto p-5 text-sm">
            <div className="flex items-start justify-between gap-4">
              <h3 id={`packeta-dialog-${props.orderId}`} className="font-serif text-lg font-bold text-gold">
                Nová zásilka Zásilkovny
              </h3>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Zavřít"
                className="px-2 text-xl leading-none text-muted hover:text-cream"
              >
                ×
              </button>
            </div>
            <input type="hidden" name="orderId" value={props.orderId} />
            <input type="hidden" name="parcelCount" value={missing} />
            <p className="text-xs text-muted">Zkontrolujte a případně upravte údaje. Zásilka se založí až potvrzením dole.</p>

            <div>
              <p className="text-muted">Výdejní místo</p>
              <p className="font-semibold">{draft.pointName}</p>
              {draft.pointAddress && <p className="text-cream/80">{draft.pointAddress}</p>}
              <p className="text-xs text-muted">ID {draft.addressId} · bez dobírky (zaplaceno předem)</p>
            </div>

            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1 text-muted">Příjemce</legend>
              <label>
                Jméno
                <input name="name" defaultValue={draft.recipient.name} maxLength={32} required className={smallCls} />
              </label>
              <label>
                Příjmení
                <input name="surname" defaultValue={draft.recipient.surname} maxLength={32} required className={smallCls} />
              </label>
              <label className="col-span-2">
                E-mail
                <input name="email" type="email" defaultValue={draft.recipient.email} required className={smallCls} />
              </label>
              <label className="col-span-2">
                Telefon (na něj přijde SMS s kódem)
                <input name="phone" defaultValue={draft.recipient.phone} required className={smallCls} />
              </label>
            </fieldset>

            {draft.parcels.map((p, i) => (
              <fieldset key={p.number} className="grid grid-cols-3 gap-2 border-t border-line pt-3">
                <legend className="col-span-3 text-muted">
                  Zásilka {p.number}
                  {draft.totalParcels > 1 && ` (${p.index + 1}/${draft.totalParcels})`} · {p.bottles} ks
                </legend>
                <label>
                  Hmotnost (kg)
                  <input name={`p${i}_weight`} defaultValue={p.weightKg} inputMode="decimal" required className={smallCls} />
                </label>
                <label className="col-span-2">
                  Hodnota pro pojištění (Kč)
                  <input name={`p${i}_value`} defaultValue={p.valueCzk} inputMode="numeric" required className={smallCls} />
                </label>
                <label>
                  Délka (mm)
                  <input name={`p${i}_length`} defaultValue={p.size.length} inputMode="numeric" required className={smallCls} />
                </label>
                <label>
                  Šířka (mm)
                  <input name={`p${i}_width`} defaultValue={p.size.width} inputMode="numeric" required className={smallCls} />
                </label>
                <label>
                  Výška (mm)
                  <input name={`p${i}_height`} defaultValue={p.size.height} inputMode="numeric" required className={smallCls} />
                </label>
                <p className="col-span-3 text-xs text-muted">
                  Rozměry jsou odhad – zadejte skutečnou krabici. Standardní zásilka: nejdelší strana max. 600 mm, součet stran max. 1 200 mm.
                </p>
              </fieldset>
            ))}

            <label className="block border-t border-line pt-3">
              Poznámka na štítek (nepovinné)
              <input name="note" maxLength={128} className={smallCls} />
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="adultContent"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
                className="mt-1 accent-[var(--gold)]"
              />
              <span>
                Ověření věku 18+ při výdeji (25 Kč)
                {!adult && <span className="block text-xs text-danger">Zásilka obsahuje alkohol – bez ověření věku ji neposílejte.</span>}
              </span>
            </label>

            <label className="block text-xs text-muted">
              Vaše jméno nebo iniciály (nepovinné, pro historii)
              <input name="actor" maxLength={40} className={smallCls} />
            </label>

            {state?.error && (
              <p role="alert" className="text-sm text-danger">
                {state.error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="border border-line px-4 py-2 text-sm text-cream hover:border-gold"
              >
                Zrušit
              </button>
              <button
                disabled={pending}
                className="flex-1 bg-gold px-4 py-2 text-sm font-bold text-ink hover:bg-gold-light disabled:opacity-60"
              >
                {pending
                  ? "Zakládám…"
                  : `Potvrdit a založit ${missing > 1 ? `${missing} zásilky` : "zásilku"}`}
              </button>
            </div>
          </form>
          </dialog>
          </>
        ))}
      {state?.ok && <Feedback state={state} />}
    </section>
  );
}

