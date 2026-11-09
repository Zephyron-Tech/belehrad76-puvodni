-- Finální fotky (9. 11. 2026): WebP z public/img (npm run images:prepare)
-- Box: otevřený, 13 lahví vedle sebe, zavřený. Lahve: nejdřív lahev, pak etiketa hráče.
UPDATE "Product"
SET "imageUrl" = '/img/box/otevreny.webp',
    "galleryUrls" = ARRAY['/img/box/otevreny.webp', '/img/box/trinact-lahvi.webp', '/img/box/zavreny.webp'],
    "updatedAt" = NOW()
WHERE "type" = 'BOX';

UPDATE "Product"
SET "imageUrl" = '/img/hraci/' || "slug" || '-lahev.webp',
    "galleryUrls" = ARRAY['/img/hraci/' || "slug" || '-lahev.webp', '/img/hraci/' || "slug" || '-etiketa.webp'],
    "updatedAt" = NOW()
WHERE "type" = 'BOTTLE';
