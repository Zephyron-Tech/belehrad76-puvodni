-- Prodávající: CATEVIO s.r.o. (dříve Petite Eiffel, s.r.o., stejné IČO 10788433) a kontaktní telefon
INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('seller.name', 'CATEVIO s.r.o.', 'Obchodní firma prodávajícího', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();

INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('contact.phone', '+420 724 247 139', 'Kontaktní telefon na webu a v e-mailech (prázdné = nezobrazovat)', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();

-- Texty stránek: případné zmínky o původním názvu firmy
UPDATE "Page" SET "body" = REPLACE("body", 'Petite Eiffel, s.r.o.', 'CATEVIO s.r.o.'), "updatedAt" = NOW()
WHERE "body" LIKE '%Petite Eiffel%';
