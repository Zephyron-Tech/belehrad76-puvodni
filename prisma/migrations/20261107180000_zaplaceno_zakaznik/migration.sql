-- Tlačítko „Zaplaceno“ pro zákazníka: čas nahlášení platby (ověřovateli hned ověřovací e-mail)
ALTER TABLE "Order" ADD COLUMN "paymentClaimedAt" TIMESTAMP(3);
