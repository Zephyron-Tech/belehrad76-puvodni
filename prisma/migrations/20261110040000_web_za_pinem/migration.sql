-- Web za PINem až do spuštění (release = nastavit site.pin na prázdnou hodnotu)
INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('site.pin', '4846', 'PIN pro vstup na web před spuštěním (prázdné = web je veřejný, release = vymazat)', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();
