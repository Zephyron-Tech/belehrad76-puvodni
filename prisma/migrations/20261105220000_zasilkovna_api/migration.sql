-- Zásilkovna: zásilky založené přes API
ALTER TABLE "Order" ADD COLUMN "packetaPacketIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "packetaBarcodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "packetaRequestedAt" TIMESTAMP(3);
