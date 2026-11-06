# Specifikace e-shopu „Mistři Evropy – Bělehrad 1976“

## 1. Kontext

Limitovaná edice slivovice k 50. výročí vítězství na ME v Bělehradě 1976. Web/e-shop (belehrad76.cz, belehrad1976.cz) slouží k prodeji edice a propagaci na sociálních sítích. Výtěžek edice jde Nadaci fotbalových internacionálů (na webu se neuvádí žádná částka). Implementace a provoz viz `README.md`.

**Prodávající:** Petite Eiffel, s.r.o., IČO 10788433, DIČ CZ10788433, U Tiskárny 616/9, Přívoz, 702 00 Ostrava, jednatel Jan Kukula. V předmětu podnikání má prodej lihovin. Údaje jsou z kurzy.cz (stav z justice.cz k 28. 4. 2026) a před spuštěním je třeba je ověřit ve výpisu z OR a v živnostenském rejstříku.

**Změny oproti původnímu zadání (potvrzeno):**
- Edice je jen slivovice, calvados odpadá. Žádný výběr varianty.
- Čísla boxů se nevedou, box je prostě „box“.
- Večer 30. 11. 2026 funguje takto: kdo koupí v předprodeji box, je zařazen do losování o vstup. Vstup pouze pro 1 osobu na 1 zakoupený box, bez doprovodu (změna 3. 11. 2026).
- Fakturace: po zaplacení se zákazníkovi pošle jen potvrzení platby a PDF s informací o zaplacení. Faktury se do e-shopu nenapojují.

## 2. Produkty (14 položek)

| Položka | Počet | Cena |
|---|---|---|
| Box „Mistři Evropy“: 13 lahví, po jedné za každého fotbalistu z mistrovství | 1 | 9 880 Kč (13 × 760) |
| Kusovka: jedna lahev konkrétního fotbalisty | 13 | 760 Kč |

- Celá edice je 152 boxů × 13 lahví = 1 976 lahví.
- **Sklad boxů (potvrzeno):** limitovaný. Z 152 boxů se jich 8 odečte předem pro dražbu na galavečeru, takže **v e-shopu je k prodeji 144 boxů**. Počáteční stav je v konfigurační tabulce v databázi.
- **Sklad kusovek (potvrzeno):** neomezený, sklad boxů a kusovek je oddělený. Kusovky se vyrábějí až po objednání, proto má produkt i objednávka upozornění na delší dodací lhůtu (počet dní doplní zadavatel).
- **Nadace:** na webu a v e-mailech se uvádí jen to, že výtěžek jde Nadaci fotbalových internacionálů. Žádná částka za lahev se nezmiňuje, ani na webu ani v košíku.
- Jména hráčů, texty, fotky a ceny dodá zadavatel. Vše je v konfiguračních tabulkách v databázi (viz 4.4).

## 2b. Vizuální vzor

Vzor vzhledu je ve složce `C:\Users\rychl\eshop\foto\`:
- `WhatsApp Image 2026-11-01 at 20.00.17.jpeg`: vizualizace boxu „Mistři Evropy – Bělehrad“. Černý box s retro fotkou mužstva, zlatým nadpisem, červenou pečetí „1976“ a 13 lahvemi. Na spodní straně stojí text „Limitovaná edice 152 sběratelských sad, 13 hráčů, 1976 lahví. Výtěžek edice jde na podporu Nadace fotbalových internacionálů“.
- `WhatsApp Image 2026-11-01 at 20.00.17 (1).jpeg`: 13 lahví vedle sebe. Každá nese jméno hráče, jeho číslo a portrét. Etiketa je krémová se zlatohnědým příjmením, červenou pečetí a logem výrobce.

**Co z toho vyplývá pro design:**
- Barevnost: černá a tmavé tóny, zlatá (příjmení, nadpisy), krémová a červená (pečeť 1976). Retro černobílé fotografie z roku 1976.
- Nadpis „Mistři Evropy – Bělehrad“ ve výrazném serifovém písmu, pečeť „1976“ jako opakovaný prvek.
- Na produktové stránce boxu galerie fotek boxu a řada 13 lahví. Každá kusovka má kartu s hráčem (jméno, číslo, portrét).
- **Fotka kusovky (zatím):** místo fotky celé lahve se u každé kusovky použije jen fotka hráče s jeho jménem, tedy výřez etikety z fotky řady lahví (portrét, jméno a číslo). Až zadavatel dodá finální fotky jednotlivých lahví, změní se odkaz na fotku v konfigurační tabulce hráčů.
- Obrázky jsou vizualizace, ne finální fotografie. Finální fotky a design dodá zadavatel (viz bod 9).

**Rozpory ve vzoru, které je třeba opravit před nasazením:**
- Box na vizualizaci nese nápis „Calvados“, ale edice je už jen slivovice.
- Na boxu jsou zkomolená jména na lahvích a nápis na straně lahví („Sélehrad 76“ místo „Bělehrad 76“). Finální texty tedy musí přijít od zadavatele.
- Použít se mají jen finální fotografie, ne tyto vizualizace.

**Předběžný seznam 13 hráčů z fotky lahví (ověřit se zadavatelem):** Ivo Viktor (1), Karol Dobiaš (2), Jozef Čapkovič (3), Anton Ondruš (4), Ján Pivarník (5), Ladislav Jurkemik (6), Antonín Panenka (7), Jozef Móder (8), Marián Masný (10), Zdeněk Nehoda (11), Koloman Gögh (12), František Veselý (16), Ján Švehlík (17).

## 3. Technologie

- Next.js (App Router, TypeScript) s Tailwindem.
- PostgreSQL (např. Neon nebo Supabase) s Prismou nebo Drizzle.
- Hosting: Vercel, nebo VPS s dockerem. Jde o malý provoz s nárazovou špičkou po spuštění prodeje a po kampani.
- E-maily: Resend nebo Postmark (transakční).
- Platby: GoPay (viz bod 5).
- Doprava: dopravce zatím neurčen (Zásilkovna odpadla), adresa se zadává ručně. Osobní převzetí na FAČR.
- Analytika: GA4 nebo Plausible, Meta Pixel a Conversions API, měření objednávek (purchase event).
- Zálohy: denní zálohy DB (managed backup, retence 14+ dní) a export objednávek do CSV.

## 4. Funkční požadavky

### 4.1 Veřejný web (česky, mobile-first)
1. **Úvod**: příběh edice, 152 × 13 = 1 976 lahví, 50 let od vítězství v Bělehradě, slivovice 50 %, CTA na objednávku.
2. **Produkt/e-shop**: fotky boxu a lahví, obsah boxu (13 hráčů), cena, tlačítko objednat. Zobrazení dostupnosti („zbývá X boxů“).
3. **Nadace**: blok s informací, že výtěžek jde Nadaci fotbalových internacionálů, bez uvedení částky, s odkazem.
4. **Večer 30. 11. 2026**: informace o slavnostním večeru moderovaném Jakubem Kohákem, za účasti čtyř českých a čtyř slovenských hráčů. Kupující z předprodeje budou zařazeni do losování o vstup (1 osoba na 1 zakoupený box). Podrobnosti losování řeší někdo jiný, web zatím nese jen obecný text, který zadavatel doplní.
5. **Dražba**: informace, že 8 boxů se bude dražit na galavečeru. Stačí informační text.
6. **Kontakt a sociální sítě**: odkazy na FB a IG, kontaktní údaje, odkaz na FAČR pro osobní převzetí.
7. Právní stránky: obchodní podmínky, ochrana osobních údajů, cookies, reklamační řád, informace o odstoupení od smlouvy.
8. **Věková brána 18+**: při vstupu na web. U objednávky navíc povinný souhlas „je mi 18 let“.

### 4.2 Košík a objednávka
- Košík: box a/nebo kusovky, počet ks, kontrola skladu v reálném čase.
- Rezervace skladu na čas platby (např. 30 min), po vypršení se sklad uvolní.
- Checkout bez účtu: jméno, e-mail, telefon, doručovací adresa nebo výdejní místo, fakturační údaje (volitelně IČO/DIČ), poznámka.
- Povinné souhlasy: obchodní podmínky, 18+, ochrana osobních údajů. Souhlas s marketingem je volitelný.
- Zaškrtávací pole „Chci se zúčastnit losování o vstup na večer 30. 11.“ (viz 4.5). Zobrazí se jen u košíku s boxem. Vstup pouze pro 1 osobu na 1 zakoupený box, jméno doprovodu se nesbírá.
- **Doprava (potvrzeno):**
  - Košík obsahuje box: doprava 490 Kč, nebo osobní převzetí na adrese FAČR zdarma.
  - Košík obsahuje jen kusovky: doprava 100 Kč za kus, nebo osobní převzetí na FAČR zdarma (potvrzeno).
  - Smíšený košík (box + kusovky): doprava 490 Kč za box plus 100 Kč za každou kusovku (potvrzeno).
  - Dopravce vybírá někdo jiný. Adresa se zadává ručně a dopravce se doplní, až bude znám.
  - Ceny dopravy jsou v konfigurační tabulce v databázi.
- Platba: karta (GoPay), bankovní tlačítko (GoPay) a ruční převod s QR kódem s ověřováním platby e-mailem, viz body 5 a 5b.

### 4.3 Po objednávce
- **Platba proběhla**: stav „zaplaceno“, odečtení skladu, e-mail s potvrzením platby a PDF s informací o zaplacení (objednávka, částka, způsob platby, prodávající, datum). Potvrzení platby se generuje až po úspěšné platbě. Žádná faktura se negeneruje.
- Okamžitě po vytvoření objednávky přijde krátký e-mail „objednávka přijata“ s údaji k platbě (u převodu s QR kódem, viz 5b). U platby přes platební bránu obsahuje zvýrazněné upozornění: „Pokud jste již zaplatili prostřednictvím platební brány na našem webu, nic dalšího neplaťte – potvrzení o přijetí platby vám zašleme samostatně.“ (Oba e-maily mohou přijít téměř současně.)
- Provozovatel (Petite Eiffel) dostane e-mail s kompletními údaji o každé zaplacené objednávce (zboží, doprava, adresa nebo osobní převzetí, kontakt, zájem o večer). Podle toho zásilky vyřizuje.
- E-mail o odeslání zásilky (s dopravcem a číslem zásilky) se posílá automaticky při přepnutí objednávky na „odeslaná“ v administraci (viz 4.4).

### 4.4 Administrace (jen správa objednávek, za přihlášením)
Plnohodnotná administrace (úprava textů, cen, fotek) se nevytváří. Je jen malá chráněná sekce pro správu objednávek:
- **Přihlášení (kvůli GDPR):** e-mail a heslo (hash), povinné dvoufázové ověření (2FA), omezení pokusů, automatické odhlášení po nečinnosti, **jeden společný účet** pro všechny, kdo objednávky vyřizují (potvrzeno), bez rolí a správy uživatelů. Přihlašovací údaje a 2FA se předávají jen oprávněným osobám a heslo jde změnit zásahem v databázi. Celá sekce `/admin` je za přihlášením a není indexovatelná. Bez přihlášení se nedá dostat k žádnému osobnímu údaji.
- **Seznam objednávek:** filtr podle stavu, hledání (číslo, jméno, e-mail), řazení podle data, zobrazení způsobu platby a dopravy.
- **Detail objednávky:** zboží, doprava, kontakt a adresa, fakturační údaje, zájem o večer, poznámka zákazníka, interní poznámka, historie změn.
- **Stavy objednávky:** přijatá (čeká na platbu), zaplacená, odeslaná, dokončená, zrušená. Platba kartou nebo přes GoPay přepne stav na „zaplacená“ automaticky. U ručního převodu to provozovatel přepne tlačítkem po připsání peněz, nebo odkazem „Zaplaceno“ z ověřovacího e-mailu (viz 5b). U každé objednávky je vidět, jak dlouho je v posledním stavu. Změna na „zaplacená“ jednorázově odečte sklad boxů a odešle potvrzení platby s PDF.
- **Odeslání:** při přepnutí na „odeslaná“ se zadá dopravce a číslo zásilky a zákazníkovi automaticky odejde e-mail o odeslání (potvrzeno). U osobního převzetí odejde e-mail „připraveno k převzetí“.
- **Export:** CSV objednávek pro účetnictví a CSV zájemců o večer (jen zaplacené objednávky se zájmem, s počtem boxů = počtem vstupů).
- **Záznam změn (audit log):** kdy a z jaké IP adresy se změnil stav objednávky nebo se vyexportovala data. Protože je účet společný, nelze poznat konkrétní osobu. Volitelně se při změně zadá jméno nebo iniciály.
- **GDPR:** přístup jen přes přihlášení, osobní údaje nejsou v logu, mazání nebo anonymizace objednávek po uplynutí zákonné doby a na žádost zákazníka (postup popsán v zásadách ochrany osobních údajů), databáze šifrovaná při přenosu a záloha chráněná.
- **Konfigurační tabulky v databázi (bez rozhraní):** ceny boxu a kusovek, sklad boxů (výchozí 144), ceny dopravy (box 490, kusovka 100 za kus), osobní převzetí a jeho adresa, dodací lhůta kusovek, texty webu, hráči (jméno, číslo, fotka), kontakty a odkazy na sociální sítě. Upravují se přímo v databázi a web je čte s krátkou cache, takže změna se projeví bez nového nasazení.

### 4.5 Losování o vstup (mimo rozsah)
- Samotné losování, jeho pravidla a kapacita řeší někdo jiný a e-shop ho neprovádí.
- E-shop jen sbírá podklady: u zaplacených objednávek eviduje zájem o účast. Dají se vyexportovat do CSV skriptem.
- Pokud se později rozhodne, že losování poběží v e-shopu, doplní se jako samostatná fáze.

## 5. Platební brána (GoPay) a platby

**Integrace:** GoPay REST API (vytvoření platby, redirect nebo inline, notifikace o stavu na webhook). Stav platby se vždy ověřuje dotazem na API, nespoléháme jen na návrat zákazníka.

**Platební metody:** platební karta (včetně Apple Pay/Google Pay, pokud brána aktivuje), rychlé bankovní platby (převod) a QR platba, pokud ji GoPay pro obchod zapne. Stav těchto plateb se mění automaticky. K tomu **ruční převod na účet 303642799/0300** s variabilním symbolem = číslo objednávky a QR kódem (SPD formát). Objednávka čeká na platbu a ověřuje se ručně podle bodu 5b.

### Co musíte zařídit (checklist pro vás)
1. **Smlouva s GoPay** na firmu Petite Eiffel, s.r.o. (IČO 10788433). Přes web gopay.com vyplnit žádost o e-shopovou bránu.
2. **Podklady pro GoPay**: výpis z OR, doklad totožnosti jednatele (Jan Kukula), doklad o živnostenském oprávnění (prodej lihovin), číslo bankovního účtu pro výplaty. GoPay může chtít i informace o skutečném majiteli.
3. **Před žádostí si ověřte u GoPay, že prodej lihovin je pro ně přípustný** a zda mají zvláštní podmínky (typicky 18+ a obchodní podmínky). Alkohol patří k rizikovějším kategoriím, takže bez tohoto potvrzení by brána nemusela jít na ostro.
4. **Web musí být před schválením veřejně dostupný** (i v testovacím režimu) s obchodními podmínkami, kontakty, cenami, způsoby dopravy a platby, reklamačním řádem a ochranou osobních údajů. GoPay web kontroluje.
5. **Testovací (sandbox) přístup**: GoPay vám po registraci vydá testovací GoID, ClientID a ClientSecret. My na nich vyvinemy a otestujeme integraci.
6. **Ostré údaje po schválení**: GoID, ClientID, ClientSecret (nepředávejte e-mailem, jen přes bezpečný kanál nebo je vložte do proměnných prostředí na hostingu).
7. **Nastavení v GoPay administraci**: povolené platební metody, adresa pro návrat zákazníka (return URL) a pro notifikace (notification URL, doplníme po zveřejnění domény), měna CZK, výplatní účet.
8. **Doména a HTTPS**: ostrá doména (belehrad76.cz / belehrad1976.cz) s platným certifikátem. Brána běží jen na HTTPS.
9. **Poplatky a vyplácení**: zjistěte sazbu za kartu/bankovní platbu a dobu výplat na účet, ať víte, kdy přijdou peníze.
10. **Test ostrého provozu**: po zapnutí ostré brány proběhne jedna reálná platba malé částky a následné vrácení.

## 5b. Platba převodem s ověřováním e-mailem (potvrzeno 6. 11. 2026)

Banka není napojená, platbu převodem ověřuje člověk s přístupem k účtu (dále **ověřovatel**). E-mail ověřovatele je
v nastavení `payment.verify_email` (teď rychlikjan52@gmail.com).

1. **Pokladna** nabízí platební bránu GoPay a **bankovní převod / QR kód** (`payment.bank_transfer = true`).
2. **Po vytvoření objednávky převodem** zákazník vidí stránku objednávky a dostane e-mail „Objednávka přijata“:
   číslo účtu, IBAN, variabilní symbol (= číslo objednávky), částka a QR kód (SPD). Zároveň **hned** odejde
   **ověřovací e-mail** ověřovateli.
3. **Zákazník platbu nehlásí** (tlačítko „Zaplatil jsem“ zrušeno 7. 11. 2026). Stránka objednávky má pod platebními
   údaji tlačítko **„Přejít na úvod“** s textem „Po zaplacení přejděte na úvod.“ Věta o době ověření
   (`payment.verify_time`, „Ověření platby obvykle trvá 5–9 hodin“) je u platebních údajů, v e-mailu
   „Objednávka přijata“ a v upomínce.
4. **Ověřovací e-mail** obsahuje vše pro kontrolu v internetovém bankovnictví: variabilní symbol a přesnou částku
   (zvýrazněné), účet/IBAN příjemce, datum objednávky, jméno, e-mail, telefon, firmu/IČO, položky a doručení.
   Obsahuje tři odkazy, které fungují **bez přihlášení** (z mobilu). Odkaz otevře stránku se shrnutím a tlačítkem
   pro potvrzení – samotné otevření odkazu nic nemění (antivirové skenery pošty odkazy otevírají samy).
   **Odkazy jsou jednorázové:** první rozhodnutí okamžitě zneplatní všechny odkazy daného e-mailu a každý nový
   ověřovací e-mail zneplatní odkazy ze starších. Po rozhodnutí se stránka pokusí zavřít okno, jinak přesměruje
   na úvod; použitý nebo starý odkaz ukáže „Odkaz už neplatí“.
   - **Zaplaceno** → objednávka je zaplacená, odečte se sklad, zákazník dostane potvrzení platby s PDF
     a provozovatel upozornění na zaplacenou objednávku (stejně jako u GoPay).
   - **Nezaplaceno – vyřeším sám** → opakované ověřovací e-maily skončí, objednávka dál čeká na platbu
     a admin ji řeší v administraci.
   - **Nezaplaceno – poslat upomínku** → zákazníkovi odejde upomínka (bod 6) a ověřování běží dál.
5. **Opakování:** dokud ověřovatel nezvolí žádnou možnost, přijde mu ověřovací e-mail znovu každých 24 hodin.
6. **Upomínka zákazníkovi:** platba zatím nedorazila, platební údaje a QR kód, **bez splatnosti**. Po upomínce začne ověřování znovu (další ověřovací e-mail za 24 hodin).
7. **Objednávky převodem se automaticky neruší.** Box zůstává rezervovaný, dokud objednávka není zaplacená,
   nebo ji **přihlášený admin** v administraci nezruší (zrušení uvolní box). Úplné zamítnutí (zrušení) jde jen
   s přihlášením. Objednávky přes GoPay se po vypršení rezervace ruší jako dosud.
   Zákazníkovi se přesto u platby převodem všude (pokladna, stránka objednávky, e-mail „Objednávka přijata“,
   upomínka) uvádí „Pokud platbu neobdržíme do 7 dní (do datum), objednávku zrušíme.“ – **jen informace**,
   automaticky se nic neruší. Po upomínce se 7 dní počítá od upomínky (`reservation.transfer_days`).
8. **Administrace:** u objednávky převodem stav ověření (čeká na ověření / nezaplaceno – řeší admin / upomínka
   odeslána) a **jak dlouho je objednávka v posledním stavu**; totéž v seznamu objednávek.
   Ruční akce Zaplaceno / Vyřeším sám / Poslat upomínku jsou i v detailu objednávky.

## 6. Právní a provozní náležitosti (pro prodej alkoholu)
- Obchodní podmínky, ochrana osobních údajů (GDPR), cookies lišta s granulárním souhlasem (analytika a Meta Pixel až po souhlasu), reklamační řád, poučení o odstoupení od smlouvy (14 dnů; u spirituálií je nutné ověřit výjimky).
- Věková brána 18+ a souhlas v objednávce. Při předání (dopravce nebo FAČR) kontrola věku. **Dopravce zatím není určen. Až bude, ověřit, že přepravu lihovin povoluje a umí ověřit věk.**
- Označení lahví a texty musí odpovídat legislativě (obsah alkoholu, upozornění). Texty bude dodávat zadavatel.
- Prodávající je Petite Eiffel, s.r.o. Údaje o ní v patičce a v podmínkách (IČO, DIČ, sídlo, kontakt). Údaje o spotřební dani u lihovin řeší výrobce/dodavatel, ne e-shop.
- Zabezpečení: HTTPS, rate limiting na formuláře, ochrana proti botům (Turnstile), administrace za přihlášením s 2FA a audit logem, přístup do databáze jen pro oprávněné osoby, platební údaje karet neprocházejí naším serverem (řeší GoPay).
- Zálohy databáze a obrazů (denně, test obnovy před spuštěním).

## 7. Sociální sítě
- Odkazy na FB a IG na webu a v patičce, sdílení produktu s náhledem (OG tagy).
- Vložení feedu Instagramu (nebo odkaz na profil, podle dostupnosti) a Meta Pixel + Conversions API pro měření objednávek.
- Zadavatel dodá oficiální účty a přístup do Business Manageru pro pixel.

## 8. Fáze realizace
1. Projekt, DB schéma, datový model (produkty, sklad, objednávky, platby, losování), seed 14 položek.
2. Veřejný web a produkt, texty a design (podle podkladů zadavatele).
3. Košík, checkout, doprava (pevné ceny podle obsahu košíku), rezervace skladu boxů.
4. GoPay integrace (sandbox), webhooky, e-maily a PDF potvrzení platby, ruční převod s QR.
5. E-mail provozovateli o zaplacené objednávce a administrace objednávek za přihlášením (stavy, export, audit log).
6. Právní stránky, cookies, 18+, měření (GA4/Pixel).
7. Testy, zálohy, ostrá brána, spuštění.

## 9. Co dodá zadavatel
Design, fotografie boxu a lahví, finální texty (včetně příběhu, 13 hráčů, Nadace, večera), logo, ceny (760 Kč lahev, 9 880 Kč box), doménu, přístupy k FB/IG, údaje GoPay, určení dopravce, znění obchodních podmínek, dodací lhůtu kusovek a text o losování.

## 10. Ověření
- Unit a integrační testy: sklad boxů (144 k prodeji), neomezené kusovky, rezervace a uvolnění, výpočet dopravy (box 490, kusovka 100 za kus, smíšený košík).
- E2E test (Playwright): od košíku po zaplacenou objednávku v GoPay sandboxu, příjem e-mailu a PDF potvrzení.
- Test GoPay platby: úspěšná, zrušená, vypršelá a opakovaná notifikace (nesmí dvakrát odečíst sklad ani poslat dvě potvrzení).
- Test ručního převodu: QR kód se správným variabilním symbolem, ruční přepnutí stavu v administraci, jednorázové odečtení skladu a odeslání potvrzení.
- Test administrace: bez přihlášení nejde otevřít žádná stránka ani export, 2FA, audit log změn stavu, přechody stavů (přijatá, zaplacená, odeslaná, dokončená, zrušená).
- Test konfigurační tabulky: změna ceny, skladu nebo textu v DB se projeví na webu bez nasazení.
- Test exportu zájemců o večer: pouze zaplacené objednávky se zájmem.
- Kontrola cookies/consent (pixel se bez souhlasu nenačte), mobilní zobrazení, Lighthouse.
- Test obnovy zálohy a testovací ostrá platba s vratkou.

## 11. Otevřené body
Vyřešeno: sklad (144 boxů, kusovky neomezené), doprava (490 / 100 za kus), losování (řeší jiný), Zásilkovna odpadla, Nadace bez částky, dražba (8 boxů, jen text).

Zbývá (neblokuje vývoj):
1. Dopravce řeší někdo jiný, ověřit lihoviny a věk 18+.
2. Dodací lhůta kusovek (text v konfigurační tabulce).
2b. Administrace má jeden společný účet, takže audit log neidentifikuje konkrétní osobu (zadavatel to bere na vědomí).
3. GoPay: schválení prodeje alkoholu řeší zadavatel během implementace.
