#!/bin/sh
# Nasazení na server webowky (Docker, /opt/belehrad76):
#   1. pošle soubory sledované gitem v aktuálním stavu (i necommitnuté úpravy; bez .env a netrackovaných souborů)
#   2. na serveru sestaví image a restartuje kontejnery (migrace a doplnění výchozích dat proběhnou při startu)
#
#   sh scripts/deploy-webowky.sh
#
# .env na serveru (/opt/belehrad76/.env) se zakládá ručně jednou a skript ho nepřepisuje.
set -eu

HOST="${DEPLOY_HOST:-webowky}"
DIR="${DEPLOY_DIR:-/opt/belehrad76}"
REV="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then REV="$REV+zmeny"; fi

echo "[deploy] zdrojáky $REV → $HOST:$DIR/src"
git ls-files -z | tar --null -T - -cf - | ssh "$HOST" "rm -rf '$DIR/src.new' && mkdir -p '$DIR/src.new' && tar -x -C '$DIR/src.new' && rm -rf '$DIR/src' && mv '$DIR/src.new' '$DIR/src' && echo '$REV' > '$DIR/src/REVISION'"

echo "[deploy] build a restart"
ssh "$HOST" "cd '$DIR' && cp src/docker-compose.yml docker-compose.yml && mkdir -p data backups && test -f .env && \
  docker compose build --build-arg BUILDKIT_INLINE_CACHE=1 app && docker compose up -d --remove-orphans && docker image prune -f >/dev/null && \
  docker compose ps"
echo "[deploy] hotovo ($REV)"
