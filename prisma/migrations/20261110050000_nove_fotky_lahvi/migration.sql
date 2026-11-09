-- Nové fotky lahví (tmavé pozadí) – stejné soubory, ?v=2 kvůli mezipaměti prohlížečů
UPDATE "Product"
SET "imageUrl" = '/img/hraci/' || "slug" || '-lahev.webp?v=2',
    "galleryUrls" = ARRAY['/img/hraci/' || "slug" || '-lahev.webp?v=2', '/img/hraci/' || "slug" || '-etiketa.webp'],
    "updatedAt" = NOW()
WHERE "type" = 'BOTTLE';
