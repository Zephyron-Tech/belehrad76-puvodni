-- Ověřovací e-maily o platbě převodem: komu a v kopii
INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('payment.verify_email', 'jan.kukula@petiteeiffel.cz, fakturace@petiteeiffel.cz', 'Kdo ověřuje platby převodem v internetovém bankovnictví – ověřovací e-mail s odkazy Zaplaceno / Nezaplaceno (víc adres oddělit čárkou)', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();

INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('payment.verify_cc', 'rychlikjan52@gmail.com', 'Kopie ověřovacích e-mailů o platbě (víc adres oddělit čárkou; prázdné = bez kopie)', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();
