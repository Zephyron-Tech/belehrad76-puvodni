-- Objednávky zatím vypnuté – e-shop bude brzy spuštěn (zapnutí: sales.open = true)
UPDATE "Setting" SET "value" = 'false', "updatedAt" = NOW() WHERE "key" = 'sales.open';
