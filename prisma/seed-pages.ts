/**
 * Výchozí texty webu v Markdownu. Po naplnění se upravují v tabulce Page.
 * V textu lze použít zástupné značky {{klic}} – dosadí se hodnota z tabulky Setting
 * (např. {{seller.name}}, {{seller.ico}}, {{contact.email}}, {{pickup.address}}).
 *
 * Texty s published=false jsou části úvodní stránky, ne samostatné stránky.
 * Právní texty: schválené znění z 9. 11. 2026 (zdroj documents/doplneno/*.docx).
 */

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
    body: `Edici představíme na galavečeru s hráči vítězného týmu. Začínáme ve 20:15 v salonku Trezor restaurace Červený Jelen v Praze, večerem provede Jakub Kohák. Pozvání přijalo 8 hráčů finálového utkání, Ivo Viktor, Karol Dobiáš, Antonín Panenka, Zdeněk Nehoda, Jozef Čapkovič, Ján Pivarník, Ladislav Jurkemik a Ján Švehlík.

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
    title: "Obchodní podmínky e-shopu Bělehrad 76",
    published: true,
    body: `## 1. Prodávající

CATEVIO s.r.o., IČO: 10788433, DIČ: CZ10788433, sídlo: U Tiskárny 616/9, Přívoz, 702 00 Ostrava, zápis v obchodním rejstříku: Krajský soud v Ostravě, oddíl C, vložka 85584. E-mail: info@belehrad76.cz, telefon: +420 724 247 139

Tyto podmínky upravují nákup zboží prostřednictvím e-shopu Bělehrad 76. Prodej lihovin je určen výhradně osobám starším 18 let.

## 2. Objednávka a uzavření smlouvy

Zboží a jeho hlavní vlastnosti, konečná cena a dostupnost jsou uvedeny u produktu. Kupující před odesláním objednávky může zkontrolovat a opravit zadané údaje. Objednávka se odesílá tlačítkem jednoznačně označeným povinností platby.

Automatické potvrzení doručení objednávky (e-mail „Potvrzení doručení objednávky“) není přijetím návrhu na uzavření smlouvy. Kupní smlouva vzniká až doručením samostatného potvrzení přijetí objednávky prodávajícím na e-mail kupujícího; toto potvrzení zasíláme po přijetí platby spolu s potvrzením o zaplacení. Potvrzení smlouvy včetně aktuálních obchodních podmínek (v příloze ve formátu PDF) obdrží kupující v uchovatelné podobě.

Sběratelské boxy jsou limitovanou edicí a prodávají se do vyprodání zásob; samostatné lahve se připravují na objednávku. Pokud zboží nelze dodat, prodávající o tom kupujícího informuje, objednávku nepřijme nebo se dohodne na jiném řešení; případnou přijatou platbu bez zbytečného odkladu vrátí.

## 3. Ceny a platby

Ceny jsou uvedeny v Kč včetně příslušné DPH. Cena dopravy je zobrazena před odesláním objednávky. Platit lze prostřednictvím platební brány GoPay (platební karta, rychlý bankovní převod, Apple Pay, Google Pay) nebo bankovním převodem s QR kódem.

Bankovní účet pro převod: 303642799/0300. Variabilním symbolem je číslo objednávky; platební údaje a QR kód budou uvedeny v potvrzení doručení objednávky. Pokud kupující platbu v platební bráně nedokončí, zašle mu prodávající platební údaje pro bankovní převod. Rezervace zboží trvá po dobu uvedenou v potvrzení; po marném uplynutí lhůty může prodávající nezaplacenou objednávku zrušit, o čemž kupujícího informuje.

## 4. Dodání a ověření věku

Zboží doručujeme v České republice. Samostatné lahve zasíláme prostřednictvím společnosti Zásilkovna s.r.o. na kupujícím zvolené výdejní místo (výdejní místa s obsluhou, nikoli Z-BOX). Sběratelské boxy doručuje na adresu kupujícího osobně zaměstnanec prodávajícího. Osobní převzetí je možné na adrese Fotbalová asociace České republiky, Diskařská 2431/4, 160 17 Praha 6, pokud je tato možnost nabídnuta v objednávce. Cena dopravy se řídí obsahem objednávky a je zobrazena před jejím odesláním.

Rozvoz objednávek začne 1. 12. 2026, po galavečeru. Předpokládaná dodací lhůta činí do 8 pracovních dnů od přijetí platby, nejdříve však od 1. 12. 2026; u objednávek zaplacených před tímto dnem tedy běží až od 1. 12. 2026, není-li u konkrétního zboží uvedeno jinak. O případném prodlení kupujícího informujeme; jeho zákonná práva při prodlení zůstávají zachována.

Zboží obsahující alkohol předáme výhradně osobě starší 18 let. Při výdeji na výdejním místě Zásilkovny, při doručení zaměstnancem prodávajícího i při osobním odběru ověřujeme věk přebírající osoby podle dokladu totožnosti. Bez prokázání plnoletosti zboží nepředáme. Pokud doručení selže, domluvíme další postup; zákonná práva spotřebitele tím nejsou dotčena.

## 5. Odstoupení od smlouvy a reklamace

Spotřebitel může zpravidla odstoupit od smlouvy uzavřené na dálku bez uvedení důvodu do 14 dnů od převzetí zboží. Podrobnosti, zákonné výjimky a vzorový formulář obsahuje samostatné Poučení o právu na odstoupení od smlouvy. Limitovanost edice ani běžná výroba na objednávku samy o sobě právo na odstoupení nevylučují.

Spotřebitel může vytknout vadu, která se projeví do dvou let od převzetí, s ohledem na povahu a použitelnost zboží. Reklamace lze uplatnit na info@belehrad76.cz nebo písemně na sídle prodávajícího. Reklamace spotřebitele bude vyřízena a spotřebitel informován nejpozději do 30 dnů, není-li výslovně dohodnuta delší lhůta. Podrobnosti uvádí Reklamační řád.

## 6. Osobní údaje

Informace o zpracování osobních údajů jsou uvedeny v Zásadách ochrany osobních údajů a v Zásadách používání cookies.

## 7. Mimosoudní řešení sporů

Spotřebitel se může obrátit na Českou obchodní inspekci (ČOI), Štěpánská 567/15, 120 00 Praha 2, www.coi.cz, která je příslušná k mimosoudnímu řešení spotřebitelských sporů. Návrh lze podat také prostřednictvím www.adr.coi.cz.

## 8. Závěrečná ustanovení

Smlouva se uzavírá v českém jazyce. Kupující obdrží potvrzení smlouvy a znění obchodních podmínek e-mailem; znění podmínek platné v době uzavření smlouvy prodávající uchovává pro doložení smluvního vztahu. Zákonná práva spotřebitele nejsou těmito podmínkami omezena.

*Účinnost od: 9. 11. 2026*`,
  },
  {
    slug: "ochrana-osobnich-udaju",
    title: "Zásady ochrany osobních údajů – Bělehrad 76",
    published: true,
    body: `## 1. Správce

CATEVIO s.r.o., IČO: 10788433, DIČ: CZ10788433, sídlo: U Tiskárny 616/9, Přívoz, 702 00 Ostrava, zápis v obchodním rejstříku: Krajský soud v Ostravě, oddíl C, vložka 85584. E-mail: info@belehrad76.cz, telefon: +420 724 247 139

## 2. Účely, údaje a právní základy

Vyřízení objednávek a dodání zboží: identifikační a kontaktní údaje, doručovací a fakturační údaje, obsah objednávky a platební informace; právní základ: plnění smlouvy (čl. 6 odst. 1 písm. b GDPR).

Účetní a daňové povinnosti: údaje na příslušných dokladech; právní základ: právní povinnost (čl. 6 odst. 1 písm. c GDPR).

Reklamace, komunikace a ochrana právních nároků: údaje související s objednávkou a komunikací; právní základ: plnění smlouvy, právní povinnost nebo oprávněný zájem na ochraně právních nároků podle konkrétní situace.

Ověření věku při předání alkoholu: ověření plnoletosti přebírající osoby; právní základ: splnění právní povinnosti. Doklady totožnosti standardně nekopírujeme ani neuchováváme.

Marketingová sdělení zasíláme na základě souhlasu, který lze kdykoli odvolat. Analytické ani marketingové cookies a obdobné technologie (např. Google Analytics, Meta Pixel) nepoužíváme.

Pokud se zákazník při nákupu sběratelského boxu v předprodeji dobrovolně přihlásí do losování o vstup na galavečer, zpracujeme jeho jméno, kontaktní údaje, počet zakoupených boxů a informaci o účasti za účelem organizace losování a pozvání vylosovaných. Pořadatelem losování je CATEVIO s.r.o.; právním základem je plnění smlouvy o účasti v losování (čl. 6 odst. 1 písm. b GDPR). Účast je dobrovolná a nemá vliv na nákup. Do losování jsou zařazeny zaplacené objednávky boxu se zaškrtnutým zájmem o účast; každý zakoupený box dává šanci na vstup pro jednu osobu. Výsledky oznámíme e-mailem do 25. 11. 2026.

## 3. Příjemci údajů

Údaje v nezbytném rozsahu zpracovávají tito příjemci a zpracovatelé: GOPAY s.r.o. (platební brána), Zásilkovna s.r.o. (doprava na výdejní místa včetně ověření věku), Hetzner Online GmbH, Německo (hosting a databáze e-shopu), Resend, USA (odesílání e-mailů z e-shopu), dodavatel technické správy e-shopu a účetní prodávajícího. Osobní doručení sběratelských boxů zajišťují zaměstnanci prodávajícího. Úplné údaje platebních karet zpracovává poskytovatel platební služby, nikoli provozovatel e-shopu.

## 4. Doba uchování

Objednávkové údaje uchováváme po dobu potřebnou pro vyřízení smlouvy a souvisejících nároků, zpravidla po dobu příslušných promlčecích lhůt. Účetní doklady zpravidla 5 let a daňové doklady, na které se vztahuje zákonná povinnost, zpravidla 10 let. Marketingové údaje zpracovávané na základě souhlasu uchováváme do jeho odvolání, nejdéle však po dobu nezbytnou pro daný účel.

Údaje k losování uchováváme po dobu trvání prodeje edice, nejméně však 4 měsíce od konání galavečera (30. 11. 2026), a dále po dobu nezbytnou k vyřízení souvisejících nároků.

## 5. Předávání mimo EHP

Osobní údaje zpracováváme v Evropské unii (hosting Hetzner, Německo). Mimo Evropský hospodářský prostor mohou být předány při odesílání e-mailů prostřednictvím služby Resend (USA), a to pouze za podmínek GDPR – na základě rozhodnutí Evropské komise o odpovídající ochraně (EU–U.S. Data Privacy Framework) nebo standardních smluvních doložek. Služby Google ani Meta pro analytiku či reklamu nepoužíváme.

## 6. Práva subjektů údajů

Máte právo na přístup k osobním údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost, námitku a odvolání souhlasu. Proti zpracování pro účely přímého marketingu můžete kdykoli vznést námitku. Některá práva podléhají zákonným podmínkám, například povinné účetní doklady nelze vymazat před uplynutím archivační lhůty.

Žádosti zasílejte na info@belehrad76.cz nebo volejte +420 724 247 139. Máte právo podat stížnost Úřadu pro ochranu osobních údajů (www.uoou.gov.cz). Automatizované individuální rozhodování s právními nebo obdobně významnými účinky neprovádíme.

*Účinnost od: 9. 11. 2026*`,
  },
  {
    slug: "cookies",
    title: "Zásady používání cookies – Bělehrad 76",
    published: true,
    body: `## 1. Provozovatel a technologie

CATEVIO s.r.o., IČO: 10788433, DIČ: CZ10788433, sídlo: U Tiskárny 616/9, Přívoz, 702 00 Ostrava, zápis v obchodním rejstříku: Krajský soud v Ostravě, oddíl C, vložka 85584. E-mail: info@belehrad76.cz, telefon: +420 724 247 139.

E-shop používá cookies a obdobné technologie (například úložiště prohlížeče) pouze k zajištění své funkčnosti.

## 2. Nezbytné technologie

Používáme pouze technicky nezbytné prostředky, zejména k uchování košíku, zabezpečení administrace a zapamatování potvrzení věku 18+ (na 5 minut). Potvrzení věku na webu nenahrazuje kontrolu plnoletosti při předání alkoholu.

## 3. Analytické a marketingové technologie

Analytické ani marketingové technologie (např. Google Analytics, Meta Pixel) nepoužíváme. Pokud bychom je v budoucnu zavedli, aktivujeme je až s vaším předchozím souhlasem a tyto zásady aktualizujeme.

## 4. Nastavení souhlasu

Protože používáme pouze technicky nezbytné cookies, souhlas s nimi nevyžadujeme. Cookies můžete smazat nebo zablokovat v nastavení svého prohlížeče; bez nich však nemusí fungovat košík ani vstup do e-shopu.

## 5. Poskytovatelé, předávání a přehled

Nezbytné cookies nastavuje pouze provozovatel e-shopu; údaje z nich nepředáváme třetím stranám.

Přehled používaných cookies a obdobných technologií:

- age\\_verified – potvrzení věku 18+ pro vstup do e-shopu; provozovatel; 5 minut
- belehrad76-cart-v1 (úložiště prohlížeče) – obsah košíku; provozovatel; do vyprázdnění košíku nebo smazání dat prohlížeče
- admin\\_session – přihlášení do administrace (jen pro správce e-shopu); provozovatel; nejvýše 12 hodin

*Účinnost od: 9. 11. 2026*`,
  },
  {
    slug: "reklamacni-rad",
    title: "Reklamační řád e-shopu Bělehrad 76",
    published: true,
    body: `## 1. Prodávající

CATEVIO s.r.o., IČO: 10788433, DIČ: CZ10788433, sídlo: U Tiskárny 616/9, Přívoz, 702 00 Ostrava, zápis v obchodním rejstříku: Krajský soud v Ostravě, oddíl C, vložka 85584. E-mail: info@belehrad76.cz, telefon: +420 724 247 139.

## 2. Odpovědnost za vady

Prodávající odpovídá za to, že zboží při převzetí odpovídá smlouvě. Spotřebitel může vytknout vadu, která se projeví do dvou let od převzetí, s přihlédnutím k povaze zboží a jeho době použitelnosti. Projeví-li se vada do jednoho roku od převzetí, má se za to, že existovala již při převzetí, pokud to povaha věci nebo vady nevylučuje.

## 3. Poškození při přepravě

Doporučujeme zkontrolovat obal a případné poškození zdokumentovat. Nepřevzetí poškozené zásilky ani sepsání protokolu s dopravcem není podmínkou reklamace. Převzetím bez výhrad zákazník o zákonná práva nepřichází.

## 4. Uplatnění reklamace

Reklamaci lze uplatnit e-mailem na info@belehrad76.cz nebo písemně na adresu sídla prodávajícího. Doporučujeme uvést identifikaci objednávky, popis vady, požadovaný způsob vyřízení a kontakt; fotografie mohou vyřízení usnadnit, nejsou však obecnou podmínkou reklamace. Originální obal není povinný. O bezpečném předání vadného zboží, zejména rozbitého skla, se domluvíme individuálně.

## 5. Práva kupujícího

Spotřebitel může požadovat odstranění vady opravou nebo výměnou, není-li zvolený způsob nemožný či nepřiměřeně nákladný. Za zákonných podmínek může požadovat přiměřenou slevu nebo odstoupit od smlouvy, zejména pokud vada nebyla řádně odstraněna, opakuje se nebo jde o podstatnou vadu. Při nevýznamné vadě odstoupení nenáleží. U číslovaných limitovaných boxů může být výměna identického kusu nemožná; další nároky zůstávají zachovány.

## 6. Lhůty a potvrzení

Při uplatnění reklamace vydáme písemné potvrzení o datu, obsahu reklamace a požadovaném způsobu vyřízení. Reklamaci včetně odstranění vady vyřídíme a spotřebitele informujeme nejpozději do 30 dnů, nedohodneme-li se výslovně na delší lhůtě. Po vyřízení vydáme potvrzení o datu a způsobu vyřízení, případně písemné odůvodnění zamítnutí. Při marném uplynutí zákonné lhůty může spotřebitel požadovat přiměřenou slevu nebo odstoupit od smlouvy.

## 7. Náklady a závěr

Při oprávněné reklamaci má kupující právo na náhradu účelně vynaložených nákladů v zákonném rozsahu. Tento řád doplňuje obchodní podmínky a neomezuje práva spotřebitele.

*Účinnost od: 9. 11. 2026*`,
  },
  {
    slug: "odstoupeni-od-smlouvy",
    title: "Poučení o právu na odstoupení od smlouvy",
    published: true,
    body: `## 1. Právo na odstoupení

Spotřebitel může od kupní smlouvy uzavřené prostřednictvím e-shopu Bělehrad 76 odstoupit bez udání důvodu do 14 dnů od převzetí zboží. Je-li z jedné objednávky dodáváno více kusů samostatně, lhůta běží od převzetí poslední dodávky.

## 2. Jak odstoupit

Odstoupení zašlete jednoznačným prohlášením na info@belehrad76.cz nebo poštou společnosti CATEVIO s.r.o. na adresu U Tiskárny 616/9, Přívoz, 702 00 Ostrava. Vzorový formulář níže můžete, ale nemusíte použít. Číslo objednávky doporučujeme uvést pro rychlejší vyřízení. Stačí oznámení odeslat před koncem 14denní lhůty.

## 3. Vrácení zboží

Zboží zašlete nebo předejte bez zbytečného odkladu, nejpozději do 14 dnů od odstoupení, na adresu U Tiskárny 616/9, Přívoz, 702 00 Ostrava. Přímé náklady na vrácení zboží nesete vy. Pro bezpečnou přepravu skleněných lahví doporučujeme vhodný ochranný obal. Odpovídáte pouze za snížení hodnoty zboží způsobené nakládáním nad rámec nutný k seznámení se s jeho povahou, vlastnostmi a funkčností.

## 4. Vrácení plateb

Vrátíme přijaté platby včetně nákladů na nejlevnější nabízený standardní způsob dodání, bez zbytečného odkladu a nejpozději do 14 dnů od oznámení odstoupení. Platby vracíme stejným způsobem, pokud se nedohodneme jinak a nevzniknou vám další náklady. Můžeme vyčkat, dokud neobdržíme zboží nebo doklad o jeho odeslání, podle toho, co nastane dříve.

## 5. Zákonné výjimky

Právo na odstoupení se neuplatní v případech uvedených v § 1837 občanského zákoníku, jsou-li splněny jejich konkrétní podmínky, například u skutečně individualizovaného zboží. Samotná limitovanost edice ani příprava standardní lahve až po objednání výjimku nezakládají. Nelze automaticky tvrdit, že každá otevřená láhev alkoholu je nevratitelná; případné použití hygienické výjimky závisí na splnění zákonných podmínek.

## 6. Vzorový formulář

Adresát: CATEVIO s.r.o., U Tiskárny 616/9, Přívoz, 702 00 Ostrava; e-mail: info@belehrad76.cz

Oznamuji, že tímto odstupuji od kupní smlouvy na následující zboží: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

Název zboží: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_  Číslo objednávky (nepovinné): \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

Datum objednání / převzetí: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

Jméno a příjmení spotřebitele: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

Adresa spotřebitele: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

Datum: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_  Podpis (pouze při listinném zaslání): \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_

*Účinnost od: 9. 11. 2026*`,
  },
];
