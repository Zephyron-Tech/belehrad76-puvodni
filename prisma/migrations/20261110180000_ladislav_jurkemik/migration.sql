-- Galavečer: „Laco Jurkemik“ → „Ladislav Jurkemik“
UPDATE "Page" SET "body" = replace("body", 'Laco Jurkemik', 'Ladislav Jurkemik') WHERE "body" LIKE '%Laco Jurkemik%';
