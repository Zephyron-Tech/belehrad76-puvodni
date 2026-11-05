-- Zásilkovna: doručení kusovek jen na výdejní místo / Z-BOX
ALTER TYPE "DeliveryMethod" ADD VALUE 'PACKETA';

ALTER TABLE "Order" ADD COLUMN "packetaPointId" TEXT,
ADD COLUMN "packetaPointName" TEXT,
ADD COLUMN "packetaPointAddress" TEXT;

-- Ceny Zásilkovny pro výdejní místo / Z-BOX (podání na podacím místě, bez DPH, ceník od 1. 11. 2026)
UPDATE "Setting" SET "value" = '72' WHERE "key" = 'packeta.standard_czk' AND "value" = '99';
UPDATE "Setting" SET "value" = '130' WHERE "key" = 'packeta.oversize_czk' AND "value" = '140';
