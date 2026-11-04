import type { NextConfig } from "next";

/**
 * Content Security Policy: odkud smí stránka načítat skripty, styly, obrázky a s kým mluvit.
 * Povolené cizí služby: Google Analytics / Tag Manager a Meta Pixel (až po souhlasu s cookies)
 * a Cloudflare Turnstile. 'unsafe-inline' u skriptů potřebuje Next.js (vkládá data stránky
 * do inline skriptů); i tak CSP blokuje skripty z cizích domén, vkládání do rámců a <base>.
 * Jen na produkčním buildu – vývojový server potřebuje eval.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com",
  "font-src 'self'",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  // HTTPS zajišťuje Traefik; HSTS se pošle i z aplikace (prohlížeč ji na http ignoruje)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Písma pro PDF potvrzení se čtou z disku – na Vercelu je nutné je přibalit k serverovým funkcím
  outputFileTracingIncludes: {
    "/**/*": ["./assets/fonts/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Obrázky: prohlížeč je drží 1 den a další týden je smí použít, zatímco si na pozadí ověří novou verzi.
      // (Krátká doba, protože finální fotky se budou nahrávat pod stejnými názvy.)
      {
        source: "/img/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
