-- Objednávky znovu povolené (web je dál za PINem, platí se převodem / QR)
UPDATE "Setting" SET "value" = 'true', "updatedAt" = NOW() WHERE "key" = 'sales.open';
