const czk = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

export function formatCzk(amount: number): string {
  return `${czk.format(amount)} Kč`;
}

const dateTime = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

export function formatDateTime(d: Date | null | undefined): string {
  return d ? dateTime.format(d) : "";
}

export function formatDate(d: Date | null | undefined): string {
  return d ? dateOnly.format(d) : "";
}

/** PSČ ve tvaru „123 45“ */
export function formatZip(zip: string | null | undefined): string {
  const digits = (zip ?? "").replace(/\s/g, "");
  return /^\d{5}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3)}` : (zip ?? "");
}

/** Skloňování: 1 box, 2–4 boxy, 5+ boxů */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

const NBSP = " ";

/**
 * Česká typografie pro texty na webu: nezlomitelná mezera za jednopísmennými předložkami
 * a spojkami (v, k, s, z, o, u, a, i) a mezi číslem a jednotkou („50 %“, „8 dní“), aby
 * na konci řádku nezůstaly samotné. Jen pro zobrazované texty, ne pro data (e-mail, účet).
 */
export function typo(text: string): string {
  return text
    .replace(/(?<=^|[\s („"])([kKsSvVzZoOuUaAiI])[ \t]+(?=\S)/g, `$1${NBSP}`)
    .replace(/(\d)[ \t]+(%|Kč|ks|dní|dnů|let|lahví|lahve|boxů|boxy|hráčů|minut)(?=$|[\s.,;:!?)–])/g, `$1${NBSP}$2`);
}

/** Doba od okamžiku do teď česky: „12 min“, „3 h 20 min“, „5 dní 3 h“. */
export function formatDuration(since: Date | null | undefined, now = new Date()): string {
  if (!since) return "";
  const minutes = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}${NBSP}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${NBSP}h ${minutes % 60}${NBSP}min`;
  const days = Math.floor(hours / 24);
  return `${days}${NBSP}${plural(days, "den", "dny", "dní")} ${hours % 24}${NBSP}h`;
}
