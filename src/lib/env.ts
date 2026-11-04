/**
 * Proměnné prostředí čtené za běhu (ne při buildu), aby šel stejný Docker image
 * použít s různou konfigurací.
 */
export type GopayMode = "mock" | "sandbox" | "production";

function read(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export const env = {
  get appUrl() {
    return read("APP_URL", "http://localhost:3000").replace(/\/+$/, "");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get secureCookies() {
    return this.appUrl.startsWith("https://");
  },
  get primaryHost() {
    return read("PRIMARY_HOST");
  },
  /**
   * Simulovaná brána (mock) jen když je výslovně nastavená, nebo při vývoji.
   * Na produkčním buildu bez GOPAY_MODE se nesmí tiše zapnout simulace – kdokoli by si
   * mohl objednávku „zaplatit“ na testovací stránce. Bez nastavení se tam použije ostrá
   * brána, která bez přihlašovacích údajů GoPay platbu jen odmítne.
   */
  get gopayMode(): GopayMode {
    const mode = read("GOPAY_MODE");
    if (mode === "production" || mode === "sandbox" || mode === "mock") return mode;
    return process.env.NODE_ENV === "production" ? "production" : "mock";
  },
  get gopayGoid() {
    return read("GOPAY_GOID");
  },
  get gopayClientId() {
    return read("GOPAY_CLIENT_ID");
  },
  get gopayClientSecret() {
    return read("GOPAY_CLIENT_SECRET");
  },
  get gopayInstruments() {
    return read("GOPAY_INSTRUMENTS", "PAYMENT_CARD,BANK_ACCOUNT")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  get smtp() {
    return {
      host: read("SMTP_HOST"),
      port: Number(read("SMTP_PORT", "587")),
      user: read("SMTP_USER"),
      password: read("SMTP_PASSWORD"),
      secure: read("SMTP_SECURE") === "true",
    };
  },
  get mailFrom() {
    return read("MAIL_FROM", "Mistři Evropy 1976 <objednavky@belehrad76.cz>");
  },
  get mailOutboxDir() {
    return read("MAIL_OUTBOX_DIR", ".mail-outbox");
  },
  get cronSecret() {
    return read("CRON_SECRET");
  },
  get turnstileSiteKey() {
    return read("TURNSTILE_SITE_KEY");
  },
  get turnstileSecretKey() {
    return read("TURNSTILE_SECRET_KEY");
  },
  get ga4Id() {
    return read("GA4_MEASUREMENT_ID");
  },
  get metaPixelId() {
    return read("META_PIXEL_ID");
  },
  get metaCapiToken() {
    return read("META_CAPI_TOKEN");
  },
};
