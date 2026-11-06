-- „Zaplatil jsem“ zrušeno (zákazník platbu nehlásí, ověřuje se jen v bankovnictví)
ALTER TABLE "Order" DROP COLUMN "paymentClaimedAt";
