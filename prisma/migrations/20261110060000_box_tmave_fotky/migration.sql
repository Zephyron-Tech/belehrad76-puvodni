-- Fotky boxu na tmavém pozadí (otevřený, zavřený), bez fotky 13 lahví vedle sebe; ?v=2 kvůli mezipaměti
UPDATE "Product"
SET "imageUrl" = '/img/box/otevreny.webp?v=2',
    "galleryUrls" = ARRAY['/img/box/otevreny.webp?v=2', '/img/box/zavreny.webp?v=2'],
    "updatedAt" = NOW()
WHERE "type" = 'BOX';
