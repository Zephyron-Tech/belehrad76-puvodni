/** Červená pečeť „1976“ jako na boxu a etiketách. */
export function Seal({ size = 120, className = "" }: { size?: number; className?: string }) {
  const id = `seal-path-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Pečeť 1976 – Mistři Evropy, Bělehrad"
    >
      <defs>
        <path id={id} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
      </defs>
      <circle cx="100" cy="100" r="96" fill="none" stroke="var(--seal)" strokeWidth="4" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="var(--seal)" strokeWidth="1.5" strokeDasharray="2 4" />
      <circle cx="100" cy="100" r="58" fill="none" stroke="var(--seal)" strokeWidth="2.5" />
      {/* Nápis přesně na obvod kruhu (2π × 74 ≈ 465): textLength rozloží písmena po celém kruhu,
          takže konec nepřeteče přes začátek (dřív vznikalo „EMISTŘI“). */}
      <text fill="var(--seal)" fontSize="15" fontWeight="700" fontFamily="var(--font-sans)">
        <textPath href={`#${id}`} startOffset="0" textLength="462" lengthAdjust="spacing">
          MISTŘI EVROPY · BĚLEHRAD · 50 LET ·
        </textPath>
      </text>
      <text
        x="100"
        y="114"
        textAnchor="middle"
        fill="var(--seal)"
        fontSize="40"
        fontWeight="800"
        fontFamily="var(--font-serif)"
      >
        1976
      </text>
    </svg>
  );
}
