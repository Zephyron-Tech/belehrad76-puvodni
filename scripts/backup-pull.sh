#!/bin/sh
# Kopie záloh databáze e-shopu mimo server: běží na serveru rychlik (cron každé 2 hodiny) a stahuje
# zálohy z webowky (/opt/belehrad76/backups) přes SSH s klíčem, který smí jen číst tuto složku
# (na webowky v ~/.ssh/authorized_keys: command="/usr/bin/rrsync -ro /opt/belehrad76/backups",restrict ...).
#
# Zálohy se na rychliku drží 90 dní. Ze serveru se nic nemaže (stahuje se bez --delete).
#
# Instalace na rychliku:
#   mkdir -p ~/bin ~/zalohy/belehrad76 && cp backup-pull.sh ~/bin/belehrad76-backup-pull.sh
#   crontab -e  →  20 */2 * * * /home/rychlik/bin/belehrad76-backup-pull.sh >> /home/rychlik/zalohy/belehrad76/pull.log 2>&1
set -eu

DEST="${BACKUP_DEST:-$HOME/zalohy/belehrad76}"
KEY="${BACKUP_KEY:-$HOME/.ssh/belehrad76_backup}"
SRC="webowky@194.37.80.254:"

mkdir -p "$DEST"
chmod 700 "$DEST"

rsync -a --chmod=D700,F600 --include='eshop-*.sql.gz' --exclude='*' \
  -e "ssh -i $KEY -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  "$SRC" "$DEST/"

find "$DEST" -name 'eshop-*.sql.gz' -mtime +90 -delete

latest="$(ls -t "$DEST"/eshop-*.sql.gz 2>/dev/null | head -1)"
if [ -z "$latest" ]; then
  echo "$(date '+%F %T') CHYBA: žádná záloha"
  exit 1
fi
# Upozornění, když je nejnovější záloha starší než 5 hodin (záloha na serveru nebo stahování nefunguje)
age_min=$(( ($(date +%s) - $(stat -c %Y "$latest")) / 60 ))
if [ "$age_min" -gt 300 ]; then
  echo "$(date '+%F %T') VAROVÁNÍ: nejnovější záloha je stará $age_min min: $latest"
else
  echo "$(date '+%F %T') OK: $(ls "$DEST"/eshop-*.sql.gz | wc -l) záloh, nejnovější $(basename "$latest")"
fi
