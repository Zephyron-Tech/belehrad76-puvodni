-- E-shop: u boxu jen fotka otevřeného boxu (zavřený z galerie pryč)
UPDATE "Product" SET "galleryUrls" = ARRAY['/img/box/otevreny.webp?v=2'], "updatedAt" = NOW() WHERE "type" = 'BOX';
