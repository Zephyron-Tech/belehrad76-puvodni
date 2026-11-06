-- DEMO: účet administrace pro vývojovou verzi na Vercelu – stejný jako lokální
-- (rychlikjan52@gmail.com, stejný 2FA klíč). Na produkci se zakládá nový účet přes admin:setup.
-- Ostatní účty nemaže.
INSERT INTO "AdminUser" ("email", "passwordHash", "totpSecret", "failedAttempts", "createdAt", "updatedAt")
VALUES ('rychlikjan52@gmail.com', '$2b$12$FjBskeFx5yDRY1bbRtwQzObDahirSgepdiymG3ac2PPzElbXEKo3W', 'NZ6VIAKXCYPUY2JX', 0, NOW(), NOW())
ON CONFLICT ("email") DO UPDATE
SET "passwordHash" = EXCLUDED."passwordHash",
    "totpSecret" = EXCLUDED."totpSecret",
    "failedAttempts" = 0,
    "lockedUntil" = NULL,
    "updatedAt" = NOW();
