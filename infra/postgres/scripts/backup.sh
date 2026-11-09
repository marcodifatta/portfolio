#!/usr/bin/env bash
# Backup completo del Postgres condiviso (tutti i database, utenti compresi).
# Pensato per il cron notturno; conserva gli ultimi KEEP_DAYS giorni.
#
#   ./scripts/backup.sh
set -euo pipefail

CONTAINER="${PG_CONTAINER:-pg-shared}"
SUPERUSER="${POSTGRES_SUPERUSER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/postgres}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
FILE="$BACKUP_DIR/pg-shared-$(date '+%Y%m%d-%H%M').sql.gz"
TMP="$FILE.partial"

umask 077
docker exec "$CONTAINER" pg_dumpall -U "$SUPERUSER" --clean --if-exists | gzip -9 > "$TMP"
# Un dump valido finisce sempre con questa riga: se manca il backup è incompleto
if ! gzip -dc "$TMP" | tail -n 5 | grep -q "PostgreSQL database cluster dump complete"; then
  echo "$(date '+%F %T') ERRORE: dump incompleto, scartato" >&2
  rm -f "$TMP"
  exit 1
fi
mv "$TMP" "$FILE"

find "$BACKUP_DIR" -name 'pg-shared-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') OK $(du -h "$FILE" | cut -f1) $FILE"
