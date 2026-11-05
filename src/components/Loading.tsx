/** Točící se kolečko v barvách webu. */
export function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-gold/25 border-t-gold ${className}`}
    />
  );
}

/** Načítání obsahu stránky (loading.tsx, načítání dat v prohlížeči). */
export function PageLoading({ label = "Načítám…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-muted">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Překryv přes celou stránku – odesílání objednávky, přesměrování na platební bránu. */
export function LoadingOverlay({ title, note }: { title: string; note?: string }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label={title}
      className="fixed inset-0 z-[250] flex flex-col items-center justify-center gap-5 bg-ink/90 px-6 text-center backdrop-blur-sm"
    >
      <Spinner className="h-12 w-12" />
      <p className="font-serif text-2xl font-bold text-gold">{title}</p>
      {note && <p className="max-w-md text-sm text-cream/80">{note}</p>}
    </div>
  );
}

/** Obrys obsahu během načítání (místo prázdného místa, které pak „skočí“). */
export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Načítám…" className="mt-8 animate-pulse">
      <ul className="divide-y divide-line border-y border-line">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex gap-4 py-4">
            <div className="h-24 w-20 shrink-0 bg-line/60" />
            <div className="flex flex-1 flex-col justify-center gap-3">
              <div className="h-4 w-1/2 bg-line/60" />
              <div className="h-3 w-1/4 bg-line/40" />
            </div>
            <div className="h-6 w-20 self-center bg-line/50" />
          </li>
        ))}
      </ul>
      <div className="ml-auto mt-6 max-w-sm space-y-3">
        <div className="h-4 bg-line/40" />
        <div className="h-4 bg-line/40" />
        <div className="h-5 bg-line/60" />
      </div>
    </div>
  );
}
