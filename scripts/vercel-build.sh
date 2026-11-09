#!/bin/sh
# Build na Vercelu: nejdřív migrace databáze (PostgreSQL na serveru zephyron), pak build aplikace.
# Migrace běží přes DATABASE_URL (případně DATABASE_URL_MIGRATE, je-li potřeba jiné spojení).
# Proměnné ze staré Neon integrace se už nepoužívají. Když databáze při buildu není k dispozici, migrace se přeskočí
# s varováním a web se nasadí i tak (migrace pak pustit ručně: npx prisma migrate deploy).
# Selže-li migrace samotná, build skončí chybou a na Vercelu zůstane předchozí verze.
set -e

MIGRATE_URL="${DATABASE_URL_MIGRATE:-$DATABASE_URL}"
# Přechodně: dokud DATABASE_URL míří na Neon (pooler), migrovat přes jeho přímé spojení
case "$DATABASE_URL" in
  *neon.tech*) MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$MIGRATE_URL}}" ;;
esac

if [ -n "$MIGRATE_URL" ]; then
  echo "[vercel-build] prisma migrate deploy"
  DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy
else
  echo "[vercel-build] VAROVÁNÍ: DATABASE_URL při buildu chybí – migrace přeskočeny"
fi

npm run build
