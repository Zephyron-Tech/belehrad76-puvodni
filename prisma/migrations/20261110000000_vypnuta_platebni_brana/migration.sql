-- Platba přes platební bránu GoPay zatím vypnutá – platí se jen převodem / QR kódem
INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('payment.gopay', 'false', 'Platba přes platební bránu GoPay (true/false). Vypnuto = platí se jen převodem / QR kódem.', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW();

UPDATE "Setting" SET "value" = 'true', "updatedAt" = NOW() WHERE "key" = 'payment.bank_transfer';
