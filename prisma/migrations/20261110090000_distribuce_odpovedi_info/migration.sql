-- Text o zahájení distribuce a odpovědi na všechny e-maily na info@belehrad76.cz
UPDATE "Setting" SET "value" = 'Distribuce od 1. 12. 2026.', "updatedAt" = NOW() WHERE "key" = 'shipping.start_note';

INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('mail.reply_to', 'info@belehrad76.cz', 'Kam jdou odpovědi na všechny e-maily z e-shopu (víc adres oddělit čárkou; prázdné = contact.email)', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "description" = EXCLUDED."description", "updatedAt" = NOW();
