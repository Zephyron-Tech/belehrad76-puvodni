# Mistři Evropy – Bělehrad 1976 (e-shop)

Web a e-shop limitované edice slivovice k 50. výročí vítězství na ME 1976. Zadání: [`SPECIFIKACE.md`](SPECIFIKACE.md).

- **Prodej:** 1 box (13 lahví, sklad 144 = 152 − 8 do dražby) + 13 kusovek (neomezeně, vyrábí se na objednávku)
- **Doprava:** objednávka s boxem kurýrem 490 Kč jednou (i více boxů a kusovky), jen kusovky Zásilkovnou na výdejní místo (bez Z-BOXů – neumí ověření věku 18+) podle hmotnosti (dráž než 490 Kč → kurýr na adresu za 490 Kč), osobní převzetí na FAČR zdarma
- **Platby:** GoPay (karta, rychlý převod, Apple/Google Pay) + ruční převod s QR kódem na účet 303642799/0300
- **Po zaplacení:** e-mail s PDF potvrzením o zaplacení (ne faktura), upozornění provozovateli
- **Administrace:** jen objednávky, za přihlášením s 2FA, jeden společný účet, audit log, exporty CSV
- **Konfigurace** (ceny, sklad, doprava, texty, hráči, kontakty): přímo v databázi, bez administrace

Technologie: Next.js 15 (App Router) · TypeScript · Tailwind 4 · PostgreSQL + Prisma 6 · nodemailer · pdf-lib · Vitest · Playwright.

---

## Lokální vývoj

Potřeba: Node 22, PostgreSQL 16+.

```bash
npm install
cp .env.example .env              # upravte DATABASE_URL
npx prisma migrate deploy         # schéma databáze
npm run db:seed                   # 14 produktů, nastavení, texty (jen doplní chybějící)
npm run admin:setup -- --email vas@email.cz   # účet administrace + QR kód pro 2FA
npm run dev                       # http://localhost:3000
```

Bez GoPay účtu běží platby v režimu `GOPAY_MODE=mock`: místo brány se otevře testovací stránka
„Simulovat úspěšnou platbu / zrušení“. Bez `SMTP_HOST` se e-maily neodesílají, ale ukládají jako `.eml`
do složky `.mail-outbox/` (lze otevřít v Outlooku / Thunderbirdu, včetně PDF a QR přílohy).

### Testy

```bash
npm test            # unit + integrační testy nad DB (databáze eshop_test, viz TEST_DATABASE_URL)
npm run test:e2e    # Playwright proti běžící aplikaci (npm run build && npm start), používá Microsoft Edge
npm run lint && npm run typecheck
```

Integrační testy běží jen proti databázi s názvem `eshop_test` (pojistka proti smazání dat).
Pokrývají: rezervace a souběžný prodej posledního boxu, výpočet dopravy, idempotentní zaplacení
(opakovaná notifikace GoPay neodečte sklad dvakrát ani nepošle dva e-maily), vypršení rezervace,
pozdě došlé platby, přeprodej, export zájemců o večer, IBAN a QR platbu.

---

## Konfigurace v databázi

Upravuje se přímo v DB (např. `npx prisma studio`, nebo nástroj hostingu). Změna se na webu projeví
do 30 sekund (nastavení), produkty a texty okamžitě – bez nového nasazení.

| Tabulka   | Co obsahuje |
|-----------|-------------|
| `Product` | Box a 13 kusovek: název, hráč, číslo, popis (Markdown), `priceCzk`, `stock` (NULL = neomezeně), `imageUrl`, `galleryUrls`, `active`, `sortOrder` |
| `Setting` | Klíč → hodnota (seznam níže) |
| `Page`    | Texty v Markdownu: `pribeh`, `nadace`, `vecer`, `drazba` (části úvodu) a právní stránky (`/obchodni-podminky`, …) |

V textech lze použít `{{klic}}` – dosadí se hodnota z `Setting` (např. `{{seller.name}}`, `{{contact.email}}`).

Nejdůležitější klíče v `Setting` (úplný seznam s popisy: [`src/config/default-settings.ts`](src/config/default-settings.ts)):

| Klíč | Výchozí | Význam |
|------|---------|--------|
| `sales.open` | `true` | Vypnutí prodeje (košík a objednávky) |
| `shipping.box_czk` | 490 | Kurýr na adresu: objednávka s boxem jednou 490 Kč; kusovky, u kterých by Zásilkovna vyšla dráž |
| `packeta.*` | ceník od 1. 11. 2026 | Zásilkovna pro kusovky (jen výdejní místo s obsluhou): ceny bez DPH, palivový a mýtný příplatek, ověření věku, hmotnost lahve a obalu (viz níže) |
| `pickup.enabled`, `pickup.address`, `pickup.note` | | Osobní převzetí na FAČR |
| `bottle.lead_time` | | Text o dodací lhůtě kusovek (8 dní) |
| `box.delivery` | | Text o doručení boxu (kurýr, 8 dní) |
| `reservation.gopay_minutes` / `reservation.transfer_days` | 30 / 7 | Jak dlouho se drží box před zaplacením |
| `order.max_boxes` / `order.max_bottles` | 10 / 50 | Limit na objednávku |
| `bank.account` | 303642799/0300 | Účet pro platbu převodem a QR |
| `contact.email`, `contact.phone`, `owner.notify_email` | | **Doplnit skutečné adresy** |
| `social.facebook_url`, `social.instagram_url`, `foundation.url` | prázdné | Odkazy (prázdné = skryté) |
| `seller.*` | Petite Eiffel, s.r.o. | Údaje prodávajícího (patička, podmínky, PDF) |
| `home.*`, `evening.date`, `seo.description` | | Texty úvodu |

**Doprava (`src/lib/shipping.ts`):** objednávka s boxem → jen kurýr na adresu (490 Kč). Jen kusovky → jen Zásilkovna
na výdejní místo s ověřením věku (mapa nabízí jen taková, bez Z-BOXů), které zákazník vybere v pokladně ve widgetu Zásilkovny (`PACKETA_API_KEY`; bez klíče se při
vývoji nabízí testovací místo). Vždy lze i osobní převzetí na FAČR zdarma. Cena Zásilkovny v ČR nezávisí na vzdálenosti, jen na hmotnosti.

```
hmotnost zásilky = lahve × (packeta.bottle_kg + packeta.padding_per_bottle_kg) + packeta.package_kg
základ           = packeta.standard_czk (do 5 kg) / packeta.oversize_czk (5–15 kg)
cena zásilky     = základ × (1 + packeta.fuel_pct %) + započaté kg × packeta.toll_per_kg_czk + packeta.age_check_czk
doprava          = součet zásilek × (1 + DPH), nahoru na celé Kč;  > shipping.box_czk → jen kurýr na adresu za shipping.box_czk
```

Do jedné zásilky se vejde 13 lahví (15 kg), víc se rozdělí. Palivový příplatek Zásilkovna mění každý měsíc
(zasilkovna.cz/ceniky-a-priplatky) – aktualizovat `packeta.fuel_pct`.

**Sklad boxů:** `Product.stock` u boxu je počet boxů k prodeji. Snižuje se už při vytvoření objednávky
(rezervace) a vrací se při zrušení / vypršení. Ruční doplnění = zvýšit `stock`.

**Fotky:** zatím jsou v `public/img` dočasné výřezy z vizualizací ve složce `foto/` (`npm run images:prepare`).
Finální fotky nahrajte do `public/img/…` (vyžaduje nasazení) nebo na jakoukoli URL a změňte `imageUrl`.

---

## Administrace objednávek

`/admin` – přihlášení e-mail + heslo + 6místný kód z aplikace (Google/Microsoft Authenticator).
Jeden společný účet; heslo i 2FA se mění příkazem `npm run admin:setup -- --email …` (odhlásí všechny).
Po 5 chybných pokusech se účet na 15 minut zablokuje, po 30 minutách nečinnosti odhlášení.

Stavy: **Přijatá (čeká na platbu) → Zaplacená → Odeslaná / Připravená k převzetí → Dokončená**, případně **Zrušená**.

- GoPay platby se označí jako zaplacené automaticky (notifikace + ověření v API).
- Převod: po připsání peněz (zkontrolovat VS = číslo objednávky a částku) tlačítko **Platba přijata**.
  Pozdě došlou platbu lze označit i u zrušené objednávky (box se znovu odečte, pokud je skladem).
- **Odesláno:** zadat dopravce a číslo zásilky → zákazníkovi odejde e-mail. U osobního převzetí e-mail „připraveno k převzetí“.
- **Zrušit:** box se vrátí na sklad; u zaplacené objednávky je nutné vrátit peníze ručně.
- **Exporty:** CSV objednávek pro účetnictví, CSV zájemců o slavnostní večer (pro organizátora losování).
- **Historie změn:** u každé objednávky kdy, odkud (IP) a volitelně kdo (iniciály) – účet je společný.
- **GDPR:** anonymizace jednotlivé dokončené/zrušené objednávky; hromadně
  `npm run gdpr:anonymize -- --months <N> [--apply]` (dobu uchování určí účetní).

---

## GoPay

1. Sandbox: v `.env` nastavte `GOPAY_MODE=sandbox`, `GOPAY_GOID`, `GOPAY_CLIENT_ID`, `GOPAY_CLIENT_SECRET`.
2. V GoPay nastavte notifikační URL `https://belehrad76.cz/api/gopay/notify` (aplikace ji posílá i v každé platbě)
   a povolené platební metody (`GOPAY_INSTRUMENTS`).
3. Ostrý provoz: `GOPAY_MODE=production` s ostrými údaji. Otestujte jednu skutečnou platbu a vratku.

Stav platby se vždy ověřuje dotazem na GoPay API (notifikace, návrat zákazníka, před zrušením po vypršení).
Checklist, co zařídit u GoPay: [`SPECIFIKACE.md` bod 5](SPECIFIKACE.md).

---

## Vývojová verze na Vercelu

Push do `main` → Vercel nasadí automaticky (`vercel.json`). Build spouští `scripts/vercel-build.sh`:
nejdřív `prisma migrate deploy` (přes `DATABASE_URL_UNPOOLED` z Neon integrace, jinak `DATABASE_URL`),
pak `npm run build`. Když databáze při buildu není dostupná, migrace se přeskočí s varováním
(pustit ručně `npx prisma migrate deploy` s přímým connection stringem bez `-pooler`).
Selže-li migrace, build skončí chybou a zůstane předchozí verze. Seed se na Vercelu nespouští.

## Nasazení (Docker, stejně jako beerCupon)

Cíl: Zephyron Hetzner VPS, složka `/home/rychlik/footbaleshop`, za existujícím Traefikem
(síť `web_proxy`, resolver `myresolver`). Domény `belehrad76.cz`, `belehrad1976.cz` (+ `www`) → A záznam na server;
vedlejší domény se přesměrují na `PRIMARY_HOST`.

Workflow `.github/workflows/deploy.yml` (zatím **jen ruční spuštění**): build image → GHCR
(`ghcr.io/zephyron-tech/footbaleshop`) → SSH na server → zapíše `.env` → `docker compose pull && up -d`.
Při startu kontejner aplikuje migrace a doplní výchozí data.

GitHub **Secrets:** `HOST`, `USERNAME`, `SSH_KEY`, `POSTGRES_PASSWORD`, `CRON_SECRET`, `GOPAY_GOID`,
`GOPAY_CLIENT_ID`, `GOPAY_CLIENT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`,
`TURNSTILE_SECRET_KEY`, `META_CAPI_TOKEN`, `PACKETA_API_KEY`, `PACKETA_API_PASSWORD`.
GitHub **Variables:** `APP_URL`, `PRIMARY_HOST`, `GOPAY_MODE`, `GOPAY_INSTRUMENTS`, `MAIL_FROM`,
`TURNSTILE_SITE_KEY`, `GA4_MEASUREMENT_ID`, `META_PIXEL_ID`.

Po prvním nasazení na serveru založte účet administrace:

```bash
docker exec -it belehrad-eshop npm run admin:setup -- --email objednavky@belehrad76.cz
```

`docker-compose.yml` obsahuje také:
- **db** – PostgreSQL 17, data v `./data/postgres`,
- **cron** – každých 5 minut ruší nezaplacené objednávky po vypršení rezervace a znovu posílá e-maily po zaplacení,
  které se dřív nepodařilo odeslat (výpadek SMTP),
- **backup** – denní `pg_dump` do `./backups`, uchovává 14 dní. **Zálohy kopírujte i mimo server**
  a před spuštěním vyzkoušejte obnovu (`gunzip -c zaloha.sql.gz | docker exec -i belehrad-db psql -U eshop eshop`).

---

## Před spuštěním prodeje

- [ ] Právní texty v tabulce `Page` jsou **pracovní návrhy** – nechat zkontrolovat právníkem, odstranit upozornění „Pracovní návrh“
- [ ] Ověřit údaje prodávajícího (výpis z OR, živnostenský rejstřík – prodej lihovin) a adresu FAČR pro převzetí
- [ ] Doplnit `contact.email`, `owner.notify_email`, telefon, odkazy na FB/IG a Nadaci, dodací lhůtu kusovek
- [ ] Nahradit vizualizace finálními fotkami (box na vizualizaci nese nápis „Calvados“ a zkomolená jména)
- [ ] GoPay: schválení prodeje lihovin, sandbox → produkce, testovací platba a vratka
- [ ] SMTP pro odesílání e-mailů (+ SPF/DKIM pro doménu odesílatele)
- [ ] Dopravce (lihoviny, ověření věku 18+)
- [ ] Účetní: potvrzení o zaplacení není daňový doklad – ověřit, zda stačí (prodávající je plátce DPH)
- [ ] GA4 / Meta Pixel ID, Turnstile klíče, DNS domén, test obnovy zálohy
