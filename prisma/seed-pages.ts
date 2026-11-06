/**
 * Výchozí texty webu v Markdownu. Po naplnění se upravují v tabulce Page.
 * V textu lze použít zástupné značky {{klic}} – dosadí se hodnota z tabulky Setting
 * (např. {{seller.name}}, {{seller.ico}}, {{contact.email}}, {{pickup.address}}).
 *
 * Texty s published=false jsou části úvodní stránky, ne samostatné stránky.
 * Právní texty jsou PRACOVNÍ NÁVRHY a před spuštěním je musí zkontrolovat právník.
 */

const DRAFT = "> **Pracovní návrh.** Před spuštěním prodeje musí text zkontrolovat a schválit právník.\n\n";

const SELLER = [
  "**{{seller.name}}**, IČO {{seller.ico}}, DIČ {{seller.dic}}, se sídlem {{seller.address}}, {{seller.register}}.",
  "Kontakt: {{contact.email}}.",
].join("\n");

export const DEFAULT_PAGES: { slug: string; title: string; body: string; published: boolean }[] = [
  {
    slug: "pribeh",
    title: "Příběh edice",
    published: false,
    body: `V roce 1976 se českoslovenští fotbalisté stali mistry Evropy. Jejich bělehradský triumf, korunovaný nezapomenutelným dloubákem Antonína Panenky, patří k největším okamžikům naší sportovní historie.

K padesátému výročí tohoto slavného vítězství vznikla pod vedením mistra palírníka Vlastislava Veselého z Vigantic speciální **50% slivovice**. Spolu s portréty fotbalových legend a reprezentativním boxem vytvářejí jedinečnou kolekci pro sběratele, fotbalové příznivce i jako výjimečný dárek.

**152 boxů. 13 hráčů. 1976 lahví.**`,
  },
  {
    slug: "nadace",
    title: "Výtěžek pro internacionály",
    published: false,
    body: `Každým nákupem podpoříte ty, kteří kdysi oblékali reprezentační dres. Z každé prodané lahve jde 100 Kč Nadaci fotbalových internacionálů, která pomáhá bývalým reprezentantům a jejich rodinám, když to potřebují. Dříve hráli za nás, teď můžeme něco vrátit my jim.`,
  },
  {
    slug: "vecer",
    title: "Galavečer 30. 11. 2026",
    published: false,
    body: `Edici představíme na galavečeru s hráči vítězného týmu. Začínáme ve 20:15 v salonku Trezor restaurace Červený Jelen v Praze, večerem provede Jakub Kohák. Pozvání přijalo 8 hráčů finálového utkání, Ivo Viktor, Karol Dobiáš, Antonín Panenka, Zdeněk Nehoda, Jozef Čapkovič, Ján Pivarník, Laco Jurkemik a Ján Švehlík.

Objednejte si box v předprodeji a při objednávce zaškrtněte zájem o účast. Zařadíme vás do losování o vstup na galavečer. Každý jeden zakoupený box dává šanci na vstup pro jednu osobu. Výsledky losování oznámíme do 25.11.2026.`,
  },
  {
    slug: "drazba",
    title: "Dražba na galavečeru",
    published: false,
    body: `Vrcholem večera bude dražba osmi boxů s čísly účastníků finále a galavečera. Hosté se do dražby můžou zapojit osobně a jako bonus obdržet box s podpisy hráčů, retro dres finálového zápasu a společné foto s hráči.`,
  },
  {
    slug: "obchodni-podminky",
    title: "Obchodní podmínky",
    published: true,
    body: `${DRAFT}## 1. Prodávající

${SELLER}

Prodávající je oprávněn k prodeji lihovin. Zboží prodáváme **pouze osobám starším 18 let**.

## 2. Objednávka a uzavření smlouvy

Kupní smlouva vzniká odesláním objednávky a jejím potvrzením e-mailem. Objednávkou kupující potvrzuje, že je starší 18 let a že se seznámil s těmito obchodními podmínkami.

Edice je limitovaná. Boxy se prodávají do vyprodání zásob. Kusovky (samostatné lahve) vyrábíme až na objednávku.

## 3. Ceny a platba

Ceny jsou uvedeny v Kč včetně DPH. K ceně zboží se připočítává cena dopravy podle zvoleného způsobu doručení.

Platit lze:
- platební kartou nebo bankovním převodem přes platební bránu GoPay,
- bankovním převodem na účet {{bank.account}} s variabilním symbolem uvedeným v objednávce.

Box je pro kupujícího rezervován po dobu uvedenou v potvrzení objednávky. Nezaplacená objednávka se po uplynutí této doby zruší.

Po zaplacení obdrží kupující e-mailem potvrzení o přijetí platby.

## 4. Dodání

Zboží doručujeme na adresu v České republice, nebo je možné jej převzít osobně na adrese: {{pickup.address}}.

{{box.delivery}} {{bottle.lead_time}}

Při převzetí zásilky je kupující nebo přebírající osoba povinna prokázat věk 18 let. Osobě mladší 18 let zboží nevydáme.

## 5. Odstoupení od smlouvy, reklamace

Práva z vadného plnění a postup při odstoupení od smlouvy upravuje [reklamační řád](/reklamacni-rad) a [poučení o odstoupení od smlouvy](/odstoupeni-od-smlouvy).

## 6. Ochrana osobních údajů

Zpracování osobních údajů popisují [zásady ochrany osobních údajů](/ochrana-osobnich-udaju).

## 7. Mimosoudní řešení sporů

K mimosoudnímu řešení spotřebitelských sporů je příslušná Česká obchodní inspekce, www.coi.cz.

## 8. Závěrečná ustanovení

Tyto obchodní podmínky jsou účinné od data zveřejnění.`,
  },
  {
    slug: "ochrana-osobnich-udaju",
    title: "Ochrana osobních údajů",
    published: true,
    body: `${DRAFT}## Správce

${SELLER}

## Jaké údaje zpracováváme a proč

- **Vyřízení objednávky** (plnění smlouvy): jméno, e-mail, telefon, doručovací adresa, případně fakturační údaje, obsah objednávky a údaje o platbě.
- **Zákonné povinnosti** (účetnictví a daně): údaje z objednávky po dobu stanovenou zákonem.
- **Slavnostní večer**: pokud o to při objednávce požádáte, evidujeme váš zájem o zařazení do losování o vstup.
- **Marketing**: jen s vaším souhlasem, který můžete kdykoli odvolat.
- **Měření návštěvnosti a reklama**: jen se souhlasem s cookies (viz [cookies](/cookies)).

## Komu údaje předáváme

- provozovateli platební brány GoPay (při platbě kartou nebo přes bránu),
- dopravci (jen údaje nutné k doručení),
- poskytovateli hostingu a e-mailových služeb,
- organizátorovi losování o vstup na slavnostní večer (jen pokud o účast projevíte zájem).

Údaje o platební kartě zpracovává výhradně platební brána, k nám se nedostanou.

## Jak dlouho údaje uchováváme

Údaje z objednávek uchováváme po dobu nezbytnou pro plnění zákonných povinností, poté je anonymizujeme. Údaje pro marketing do odvolání souhlasu.

## Vaše práva

Máte právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a vznesení námitky. Souhlas můžete kdykoli odvolat. Žádosti posílejte na {{contact.email}}. Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů (www.uoou.cz).`,
  },
  {
    slug: "cookies",
    title: "Cookies",
    published: true,
    body: `${DRAFT}Web používá cookies. Nezbytné cookies jsou nutné pro fungování webu, ostatní používáme jen s vaším souhlasem.

## Nezbytné

- potvrzení věku 18+ (platí 5 minut),
- obsah košíku (ukládá se ve vašem prohlížeči),
- uložení vaší volby k cookies,
- přihlášení do administrace (jen pro provozovatele).

## Analytické (se souhlasem)

- Google Analytics 4 – měření návštěvnosti a objednávek.

## Marketingové (se souhlasem)

- Meta Pixel (Facebook, Instagram) – měření účinnosti reklamy a objednávek.

Souhlas můžete kdykoli změnit odkazem **Nastavení cookies** v patičce webu.`,
  },
  {
    slug: "reklamacni-rad",
    title: "Reklamační řád",
    published: true,
    body: `${DRAFT}## Prodávající

${SELLER}

## Práva z vadného plnění

Prodávající odpovídá za to, že zboží při převzetí nemá vady. Pokud zjistíte vadu (např. poškozenou lahev nebo box při přepravě), kontaktujte nás bez zbytečného odkladu na {{contact.email}}, ideálně s fotografií a číslem objednávky.

**Poškozenou zásilku doporučujeme nepřebírat**, případně sepsat s dopravcem záznam o poškození.

## Vyřízení reklamace

Reklamaci vyřídíme nejpozději do 30 dnů od jejího uplatnění. O vyřízení vás budeme informovat e-mailem.`,
  },
  {
    slug: "odstoupeni-od-smlouvy",
    title: "Odstoupení od smlouvy",
    published: true,
    body: `${DRAFT}Jako spotřebitel máte právo odstoupit od kupní smlouvy uzavřené na dálku bez udání důvodu do **14 dnů** od převzetí zboží.

Odstoupení nám zašlete e-mailem na {{contact.email}} nebo dopisem na adresu {{seller.address}}. Uveďte číslo objednávky a číslo účtu pro vrácení peněz.

Zboží vraťte nepoškozené, nejlépe v původním balení, do 14 dnů od odstoupení. Náklady na vrácení nesete vy. Peníze vrátíme do 14 dnů od odstoupení, ne však dříve, než nám zboží dorazí zpět.

Od smlouvy nelze odstoupit u zboží v uzavřeném obalu, které bylo z obalu vyňato a z hygienických důvodů jej nelze vrátit (otevřená lahev).

_Konkrétní výjimky pro lihoviny a zboží vyráběné na objednávku posoudí právník._`,
  },
];
