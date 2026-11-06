-- Schválené texty webu (6. 11. 2026): úvod, příběh, soupiska, box, výtěžek, galavečer, dražba.
-- Přepisuje texty bez ohledu na předchozí znění (schválená verze má přednost).

INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('home.hero_lead', $t$Třináct hráčů finále, každý na vlastní lahvi speciální 50% slivovice.
Legendární vítězství. Výjimečná sběratelská edice: 152 číslovaných boxů po 13 lahvích, dohromady 1976 lahví.$t$, 'Úvodní odstavec (nový řádek = nový odstavec)', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();

INSERT INTO "Page" ("slug", "title", "body", "published", "updatedAt")
VALUES ('pribeh', $t$Příběh edice$t$, $t$V roce 1976 se českoslovenští fotbalisté stali mistry Evropy. Jejich bělehradský triumf, korunovaný nezapomenutelným dloubákem Antonína Panenky, patří k největším okamžikům naší sportovní historie.

K padesátému výročí tohoto slavného vítězství vznikla pod vedením mistra palírníka Vlastislava Veselého z Vigantic speciální **50% slivovice**. Spolu s portréty fotbalových legend a reprezentativním boxem vytvářejí jedinečnou kolekci pro sběratele, fotbalové příznivce i jako výjimečný dárek.

**152 boxů. 13 hráčů. 1976 lahví.**$t$, false, NOW())
ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "updatedAt" = NOW();

INSERT INTO "Page" ("slug", "title", "body", "published", "updatedAt")
VALUES ('nadace', $t$Výtěžek pro internacionály$t$, $t$Každým nákupem podpoříte ty, kteří kdysi oblékali reprezentační dres. Z každé prodané lahve jde 100 Kč Nadaci fotbalových internacionálů, která pomáhá bývalým reprezentantům a jejich rodinám, když to potřebují. Dříve hráli za nás, teď můžeme něco vrátit my jim.$t$, false, NOW())
ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "updatedAt" = NOW();

INSERT INTO "Page" ("slug", "title", "body", "published", "updatedAt")
VALUES ('vecer', $t$Galavečer 30. 11. 2026$t$, $t$Edici představíme na galavečeru s hráči vítězného týmu. Začínáme ve 20:15 v salonku Trezor restaurace Červený Jelen v Praze, večerem provede Jakub Kohák. Pozvání přijalo 8 hráčů finálového utkání, Ivo Viktor, Karol Dobiáš, Antonín Panenka, Zdeněk Nehoda, Jozef Čapkovič, Ján Pivarník, Laco Jurkemik a Ján Švehlík.

Objednejte si box v předprodeji a při objednávce zaškrtněte zájem o účast. Zařadíme vás do losování o vstup na galavečer. Každý jeden zakoupený box dává šanci na vstup pro jednu osobu. Výsledky losování oznámíme do 25.11.2026.$t$, false, NOW())
ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "updatedAt" = NOW();

INSERT INTO "Page" ("slug", "title", "body", "published", "updatedAt")
VALUES ('drazba', $t$Dražba na galavečeru$t$, $t$Vrcholem večera bude dražba osmi boxů s čísly účastníků finále a galavečera. Hosté se do dražby můžou zapojit osobně a jako bonus obdržet box s podpisy hráčů, retro dres finálového zápasu a společné foto s hráči.$t$, false, NOW())
ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "updatedAt" = NOW();

UPDATE "Product" SET "shortDescription" = $t$Všech 13 hráčů finále v jednom číslovaném boxu. V každé lahvi 0,35l 50% Slivovice. Limitovaná edice 152 boxů.$t$, "updatedAt" = NOW()
WHERE "type" = 'BOX';
