import path from "node:path";
import os from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // testy nad databází běží postupně
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://eshop@localhost:5544/eshop_test",
      APP_URL: "http://localhost:3000",
      GOPAY_MODE: "mock",
      SMTP_HOST: "",
      MAIL_OUTBOX_DIR: path.join(os.tmpdir(), "eshop-test-outbox"),
      META_PIXEL_ID: "",
      META_CAPI_TOKEN: "",
      TURNSTILE_SECRET_KEY: "",
      // Zásilkovna: testy nikdy nevolají skutečné API (neexistující adresa, odpovědi se podvrhují)
      PACKETA_API_PASSWORD: "test-heslo",
      PACKETA_API_URL: "http://packeta.invalid/api/rest",
    },
  },
});
