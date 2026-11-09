-- Kdy začne rozvoz objednávek (pokladna, stránka objednávky, e-maily)
INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('shipping.start_note', 'Rozvoz objednávek začne až 1. 12. 2026, po galavečeru.', 'Kdy začne rozvoz objednávek – pokladna, stránka objednávky a e-maily (prázdné = nezobrazovat)', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();

-- Jednotně „galavečer“ místo „slavnostní večer“
UPDATE "Setting" SET "description" = 'Datum galavečera' WHERE "key" = 'evening.date';
UPDATE "Setting" SET "value" = REPLACE(REPLACE(REPLACE(REPLACE("value", 'slavnostního večera', 'galavečera'), 'slavnostním večeru', 'galavečeru'), 'Slavnostní večer', 'Galavečer'), 'slavnostní večer', 'galavečer'), "updatedAt" = NOW()
WHERE "value" ILIKE '%slavnostn%';
UPDATE "Page" SET
  "title" = REPLACE(REPLACE("title", 'Slavnostní večer', 'Galavečer'), 'slavnostní večer', 'galavečer'),
  "body" = REPLACE(REPLACE(REPLACE(REPLACE("body", 'slavnostního večera', 'galavečera'), 'slavnostním večeru', 'galavečeru'), 'Slavnostní večer', 'Galavečer'), 'slavnostní večer', 'galavečer'),
  "updatedAt" = NOW()
WHERE "title" ILIKE '%slavnostn%' OR "body" ILIKE '%slavnostn%';
UPDATE "Product" SET "description" = REPLACE(REPLACE("description", 'Slavnostní večer', 'Galavečer'), 'slavnostní večer', 'galavečer')
WHERE "description" ILIKE '%slavnostn%';
