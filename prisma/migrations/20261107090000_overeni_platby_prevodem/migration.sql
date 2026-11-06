-- Platba převodem s ověřováním e-mailem (SPECIFIKACE 5b)
CREATE TYPE "TransferVerifyState" AS ENUM ('WAITING', 'MANUAL');

ALTER TABLE "Order" ADD COLUMN "verifyToken" TEXT,
ADD COLUMN "verifyState" "TransferVerifyState",
ADD COLUMN "verifyMailSentAt" TIMESTAMP(3),
ADD COLUMN "paymentClaimedAt" TIMESTAMP(3),
ADD COLUMN "reminderSentAt" TIMESTAMP(3),
ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Order_verifyToken_key" ON "Order"("verifyToken");

-- U stávajících objednávek: poslední změna stavu podle časových razítek
UPDATE "Order" SET "stateChangedAt" = COALESCE("cancelledAt", "completedAt", "shippedAt", "paidAt", "createdAt");

-- Platba převodem / QR znovu zapnutá, e-mail ověřovatele a doba ověření
INSERT INTO "Setting" ("key", "value", "description", "updatedAt")
VALUES ('payment.bank_transfer', 'true', 'Platba bankovním převodem / QR kódem (true/false). Vypnuto = platí se jen přes platební bránu GoPay.', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = 'true', "updatedAt" = NOW();
