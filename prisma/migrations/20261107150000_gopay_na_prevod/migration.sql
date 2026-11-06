-- Nezaplacená GoPay objednávka se po 60 minutách převede na platbu převodem / QR (SPECIFIKACE 5b)
UPDATE "Setting" SET "value" = '60', "updatedAt" = NOW() WHERE "key" = 'reservation.gopay_minutes' AND "value" = '30';
