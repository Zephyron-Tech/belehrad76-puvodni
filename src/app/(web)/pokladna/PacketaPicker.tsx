"use client";

import { useState } from "react";

export type PacketaPoint = { id: string; name: string; address: string };

/** Výdejní místo z widgetu Zásilkovny (v6) – používáme jen tato pole. */
type WidgetPoint = {
  id: number | string;
  name?: string;
  place?: string;
  street?: string;
  city?: string;
  zip?: string;
  /** "zbox" u Z-BOXů */
  group?: string;
};

declare global {
  interface Window {
    Packeta?: { Widget: { pick: (apiKey: string, cb: (p: WidgetPoint | null) => void, opts?: Record<string, unknown>) => void } };
  }
}

const WIDGET_SRC = "https://widget.packeta.com/v6/www/js/library.js";

/** Testovací místo pro vývoj bez API klíče Zásilkovny. */
const MOCK_POINT: PacketaPoint = { id: "1", name: "TESTOVACÍ výdejní místo (vývoj)", address: "Diskařská 2431/4, 160 00 Praha 6" };

let widgetLoading: Promise<void> | null = null;
function loadWidget(): Promise<void> {
  if (window.Packeta) return Promise.resolve();
  widgetLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      widgetLoading = null;
      reject(new Error("widget"));
    };
    document.head.appendChild(s);
  });
  return widgetLoading;
}

function toPoint(p: WidgetPoint): PacketaPoint {
  const cityLine = [p.zip, p.city].filter(Boolean).join(" ");
  return {
    id: String(p.id),
    name: p.place && p.name && !p.name.includes(p.place) ? `${p.place}, ${p.name}` : (p.name ?? p.place ?? `Výdejní místo ${p.id}`),
    address: [p.street, cityLine].filter(Boolean).join(", "),
  };
}

export function PacketaPicker(props: {
  apiKey?: string;
  mock: boolean;
  value: PacketaPoint | null;
  onChange: (p: PacketaPoint | null) => void;
  error?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function open() {
    setLoadError(null);
    if (!props.apiKey) {
      if (props.mock) props.onChange(MOCK_POINT);
      else setLoadError("Výběr výdejního místa teď není k dispozici. Zkuste to prosím později nebo nás kontaktujte.");
      return;
    }
    setBusy(true);
    try {
      await loadWidget();
      window.Packeta!.Widget.pick(
        props.apiKey,
        (p) => {
          if (!p) return;
          // Z-BOX neumí ověřit věk 18+ – zásilku s alkoholem do něj Zásilkovna nedoručí
          if (p.group === "zbox" || /z-box/i.test(`${p.name ?? ""} ${p.place ?? ""}`)) {
            setLoadError("Do Z-BOXu nelze posílat alkohol (nemá ověření věku 18+). Vyberte prosím výdejní místo s obsluhou.");
            return;
          }
          props.onChange(toPoint(p));
        },
        // vendors [{ country: "cz" }] = jen výdejní místa Zásilkovny s obsluhou (Z-BOXy mají skupinu "zbox" a nezobrazí se);
        // livePickupPoint = jen místa s ověřením věku 18+
        { language: "cs", view: "modal", vendors: [{ country: "cz" }], livePickupPoint: true },
      );
    } catch {
      setLoadError("Mapu výdejních míst se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border border-line p-4">
      {props.value ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Vybrané výdejní místo</p>
            <p className="font-semibold text-cream">{props.value.name}</p>
            {props.value.address && <p className="text-sm text-cream/80">{props.value.address}</p>}
          </div>
          <button type="button" onClick={open} disabled={busy} className="border border-line px-3 py-1.5 text-sm text-cream hover:border-gold">
            Změnit
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={busy}
          aria-describedby={props.error ? "packetaPoint-error" : undefined}
          className="bg-gold px-4 py-2 text-sm font-bold text-ink hover:bg-gold-light disabled:opacity-60"
        >
          {busy ? "Načítám mapu…" : "Vybrat výdejní místo"}
        </button>
      )}
      {!props.apiKey && props.mock && <p className="mt-2 text-xs text-warn">Vývoj: bez API klíče Zásilkovny se vybere testovací místo.</p>}
      {(props.error || loadError) && (
        <p id="packetaPoint-error" className="mt-2 text-sm text-danger">
          {props.error ?? loadError}
        </p>
      )}
    </div>
  );
}
