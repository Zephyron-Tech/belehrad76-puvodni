import { expect, test, type Page } from "@playwright/test";
import { authenticator } from "otplib";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ADMIN_EMAIL = "e2e-admin@example.com";
const ADMIN_PASSWORD = "e2e-heslo-dostatecne-dlouhe";
const TOTP_SECRET = authenticator.generateSecret();
const BOX_SLUG = "box-mistri-evropy";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.adminUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), totpSecret: TOTP_SECRET, failedAttempts: 0, lockedUntil: null },
    create: { email: ADMIN_EMAIL, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), totpSecret: TOTP_SECRET },
  });
});

test.afterAll(async () => {
  await prisma.adminUser.deleteMany({ where: { email: ADMIN_EMAIL } });
  await prisma.$disconnect();
});

async function boxStock() {
  return (await prisma.product.findUniqueOrThrow({ where: { slug: BOX_SLUG } })).stock;
}

async function passGates(page: Page) {
  // Úvodní stránka je bez věkové brány, brána je až při vstupu do e-shopu
  await page.goto("/");
  await page.getByRole("button", { name: "Jen nezbytné" }).click();
  await expect(page.getByRole("dialog", { name: /18 let/ })).toBeHidden();
  await page.goto("/eshop");
  await expect(page.getByRole("dialog", { name: /18 let/ })).toBeVisible();
  await expect(page.getByText(/stránky s prodejem alkoholu/)).toBeVisible();
  await page.getByRole("button", { name: "Ano, je mi 18+" }).click();
  await expect(page.getByRole("dialog", { name: /18 let/ })).toBeHidden();
  // Proklik v rámci webu: brána se znovu neukáže
  await page.getByRole("link", { name: "Ivo Viktor" }).first().click();
  await expect(page).toHaveURL(/\/produkt\//);
  await expect(page.getByRole("dialog", { name: /18 let/ })).toBeHidden();
  // Potvrzení je v cookie s platností 5 minut: po obnovení stránky brána není
  const ageCookie = (await page.context().cookies()).find((c) => c.name === "age_verified");
  expect(ageCookie?.value).toBe("1");
  expect(ageCookie!.expires - Date.now() / 1000).toBeGreaterThan(280);
  expect(ageCookie!.expires - Date.now() / 1000).toBeLessThanOrEqual(301);
  await page.reload();
  await expect(page.getByRole("dialog", { name: /18 let/ })).toBeHidden();
  // Po vypršení (smazaná cookie) se brána ukáže znovu i při prokliku bez obnovení
  await page.context().clearCookies({ name: "age_verified" });
  await page.getByRole("link", { name: "E-shop" }).first().click();
  await expect(page).toHaveURL(/\/eshop$/);
  await expect(page.getByRole("dialog", { name: /18 let/ })).toBeVisible();
  await page.getByRole("button", { name: "Ano, je mi 18+" }).click();
  await page.goto("/");
}

/** Stránka e-shopu; potvrzení věku platí 5 minut, brána se zobrazí jen po jeho vypršení. */
async function gotoShop(page: Page, path: string) {
  await page.goto(path);
  const gate = page.getByRole("dialog", { name: /18 let/ });
  if (await gate.isVisible()) await page.getByRole("button", { name: "Ano, je mi 18+" }).click();
  await expect(gate).toBeHidden();
}

async function fillCustomer(page: Page, email: string) {
  await page.getByLabel("Jméno *").fill("Testovací");
  await page.getByLabel("Příjmení *").fill("Zákazník");
  await page.getByLabel("E-mail *").fill(email);
  await page.getByLabel("Telefon *").fill("+420 777 123 456");
}

async function acceptConsents(page: Page) {
  await page.getByLabel(/více než 18 let/).check();
  await page.getByLabel(/obchodními podmínkami/).check();
  await page.getByLabel(/zásadami ochrany osobních údajů/).check();
}

let transferOrderNumber = "";

test("zákazník: box + kusovka, platba kartou přes (simulovanou) GoPay, zájem o večer", async ({ page }) => {
  const stockBefore = await boxStock();
  await passGates(page);

  // Úvod: příběh, Nadace bez částky, večer
  await expect(page.getByRole("heading", { name: "Mistři Evropy", exact: true })).toBeVisible();
  await expect(page.getByText(/Výtěžek edice jde na podporu/).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("100 Kč z");

  // Box do košíku
  // Box nemá vlastní stránku: přesměruje se do e-shopu, kupuje se tam
  await gotoShop(page, `/produkt/${BOX_SLUG}`);
  await expect(page).toHaveURL(/\/eshop$/);
  const boxSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Box Mistři Evropy" }) });
  await expect(boxSection.getByRole("link")).toHaveCount(0);
  await expect(boxSection.getByText("Box doručujeme kurýrem, dodací lhůta je 8 dní.")).toBeVisible();
  await expect(page.getByText("Antonín Panenka").first()).toBeVisible();
  await boxSection.getByRole("button", { name: "Do košíku" }).click();
  await expect(boxSection.getByRole("button", { name: "Přidáno ✓" })).toBeVisible();

  // Kusovka do košíku
  await gotoShop(page, "/produkt/antonin-panenka");
  await expect(page.getByText(/připravujeme až na objednávku, dodací lhůta je 8\sdní/)).toBeVisible();
  await page.getByRole("button", { name: "Do košíku" }).click();

  // Košík: 9 880 + 760, doprava jednou 490 (box v košíku)
  await gotoShop(page, "/kosik");
  await expect(page.getByText("10 640 Kč").first()).toBeVisible();
  await expect(page.getByText("490 Kč", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "K objednávce" }).click();

  // Pokladna
  await expect(page).toHaveURL(/\/pokladna/);
  await fillCustomer(page, "e2e-gopay@example.com");
  await page.getByLabel("Ulice a číslo popisné *").fill("Diskařská 1");
  await page.getByLabel("Město *").fill("Praha");
  await page.getByLabel("PSČ *").fill("160 00");
  await page.getByLabel(/Chci se zúčastnit losování/).check();
  await expect(page.getByLabel(/Jméno doprovodu/)).toHaveCount(0);
  await acceptConsents(page);
  await expect(page.locator("aside")).toContainText("11 130 Kč");
  await page.getByRole("button", { name: "Objednat a zaplatit" }).click();

  // Simulovaná brána
  await expect(page).toHaveURL(/\/platba-test\//);
  await expect(page.getByText("11 130 Kč")).toBeVisible();
  await page.getByRole("button", { name: "Simulovat úspěšnou platbu" }).click();

  await expect(page.getByRole("heading", { name: "Děkujeme, platba je přijata" })).toBeVisible();
  await expect(page.getByText(/^Zájem o losování o vstup/)).toBeVisible();
  await expect(page.getByText("Vstup pouze pro 1 osobu na 1 zakoupený box.")).toBeVisible();
  expect(await boxStock()).toBe((stockBefore ?? 0) - 1);

  const order = await prisma.order.findFirstOrThrow({ where: { email: "e2e-gopay@example.com" }, orderBy: { id: "desc" } });
  expect(order.status).toBe("PAID");
  expect(order.paymentConfirmationSentAt).not.toBeNull();
  expect(order.totalCzk).toBe(11130);
});

test("zákazník: kusovky, osobní převzetí a platba převodem s QR kódem", async ({ page }) => {
  await passGates(page);
  await gotoShop(page, "/eshop");
  const card = page.locator("#lahve > div > div").filter({ hasText: "Ivo Viktor" });
  await card.getByRole("button", { name: "Do košíku" }).click();
  await card.getByRole("button", { name: "Do košíku" }).click();

  await gotoShop(page, "/pokladna");
  await fillCustomer(page, "e2e-prevod@example.com");
  await page.getByLabel(/Osobní převzetí na FAČR/).check();
  await expect(page.getByLabel("Ulice a číslo popisné *")).toBeHidden();
  await page.getByLabel(/Bankovním převodem \/ QR kódem/).check();
  // Jen kusovky: bez losování o vstup na večer
  await expect(page.getByLabel(/Chci se zúčastnit losování/)).toHaveCount(0);
  await acceptConsents(page);
  await expect(page.locator("aside")).toContainText("1 520 Kč");
  await page.getByRole("button", { name: "Objednat s povinností platby" }).click();

  await expect(page.getByRole("heading", { name: "Objednávka přijata" })).toBeVisible();
  await expect(page.getByText("303642799/0300")).toBeVisible();
  await expect(page.getByAltText("QR kód pro platbu")).toBeVisible();
  const order = await prisma.order.findFirstOrThrow({ where: { email: "e2e-prevod@example.com" }, orderBy: { id: "desc" } });
  transferOrderNumber = order.number;
  await expect(page.getByText(order.number).first()).toBeVisible();
  expect(order.shippingCzk).toBe(0);
  expect(order.status).toBe("PENDING");
});

test("validace pokladny: chybějící údaje a souhlasy", async ({ page }) => {
  await passGates(page);
  await gotoShop(page, "/produkt/jan-svehlik");
  await page.getByRole("button", { name: "Do košíku" }).click();
  await gotoShop(page, "/pokladna");
  await page.getByRole("button", { name: "Objednat a zaplatit" }).click();
  await expect(page.getByRole("alert").first()).toContainText("Zkontrolujte");
  await expect(page.getByText("Vyplňte jméno.")).toBeVisible();
  await expect(page.getByText("Prodej je možný jen osobám starším 18 let.")).toBeVisible();
});

test("administrace: bez přihlášení nic, přihlášení s 2FA, platba převodem, převzetí, export", async ({ page, request }) => {
  // Bez přihlášení
  expect((await request.get("/admin/export/vecer", { maxRedirects: 0 })).status()).toBe(307);
  // Podvržená cookie: stránky administrace přesměrují a v odpovědi nesmí být žádná data objednávek
  for (const path of ["/admin", `/admin/objednavky/${(await prisma.order.findFirstOrThrow({ orderBy: { id: "desc" } })).id}`, "/admin/exporty"]) {
    const res = await request.get(path, { maxRedirects: 0, headers: { cookie: "admin_session=podvrh" } });
    expect(res.status(), path).toBe(307);
    expect(await res.text(), path).not.toMatch(/@example\.com/);
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);

  // Špatný kód
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Heslo").fill(ADMIN_PASSWORD);
  await page.getByLabel("Ověřovací kód (2FA)").fill("000000");
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await expect(page.getByText("Neplatné přihlašovací údaje nebo ověřovací kód.")).toBeVisible();

  // Správně
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Heslo").fill(ADMIN_PASSWORD);
  await page.getByLabel("Ověřovací kód (2FA)").fill(authenticator.generate(TOTP_SECRET));
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await expect(page.getByRole("heading", { name: "Objednávky" })).toBeVisible();

  // Objednávka převodem
  await page.getByPlaceholder("Číslo, jméno, e-mail, telefon").fill(transferOrderNumber);
  await page.getByRole("button", { name: "Hledat" }).click();
  await page.getByRole("link", { name: transferOrderNumber }).click();
  await expect(page.getByRole("heading", { name: `Objednávka ${transferOrderNumber}` })).toBeVisible();

  await page.getByLabel(/Vaše jméno nebo iniciály/).fill("E2E");
  await page.getByRole("button", { name: "Platba přijata → Zaplacená" }).click();
  await expect(page.getByText("Stav objednávky byl změněn.")).toBeVisible();
  await expect(page.locator("main").getByText("Zaplacená", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Připraveno k převzetí" }).click();
  await expect(page.getByText("Připravená k převzetí").first()).toBeVisible();
  await page.getByRole("button", { name: "Předáno zákazníkovi → Dokončená" }).click();
  await expect(page.getByText("Objednávka je uzavřená, další změny stavu nejsou možné.")).toBeVisible();
  await expect(page.getByText(/administrace · E2E/).first()).toBeVisible();

  const order = await prisma.order.findUniqueOrThrow({ where: { number: transferOrderNumber } });
  expect(order.status).toBe("COMPLETED");
  expect(order.paymentConfirmationSentAt).not.toBeNull();
  expect(order.shippedMailSentAt).not.toBeNull();

  // Export zájemců o večer (přihlášený)
  const csv = await page.request.get("/admin/export/vecer");
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text).toContain("e2e-gopay@example.com");
  expect(text).not.toContain("Doprovod");
  expect(text).not.toContain("e2e-prevod@example.com");

  // Odhlášení
  await page.getByRole("button", { name: "Odhlásit" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});
