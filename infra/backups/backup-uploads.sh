#!/usr/bin/env bash
# Backup dei file caricati dal portfolio (loghi, screenshot, immagine della prima schermata, CV):
# archivia il volume Docker portfolio_uploads in ~/backups/uploads e conserva gli ultimi KEEP_DAYS giorni.
# Usa l'immagine del portfolio (già sul server) solo per avere tar: nessuna immagine da scaricare.
#
#   ~/portfolio/infra/backups/backup-uploads.sh
#
# Ripristino (sovrascrive i file del volume con quelli dell'archivio):
#   docker run --rm -v portfolio_uploads:/data -v ~/backups/uploads:/backup:ro --entrypoint tar mdf-portfolio \
#     xzf /backup/portfolio-uploads-AAAAMMGG-HHMM.tgz -C /data
set -euo pipefail

VOLUME="${VOLUME:-portfolio_uploads}"
IMAGE="${IMAGE:-mdf-portfolio}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/uploads}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
NAME="portfolio-uploads-$(date '+%Y%m%d-%H%M').tgz"

docker run --rm --user "$(id -u):$(id -g)" -v "$VOLUME":/data:ro -v "$BACKUP_DIR":/backup --entrypoint tar "$IMAGE" \
  czf "/backup/$NAME.partial" -C /data .
# l'archivio deve essere leggibile per intero, altrimenti viene scartato
if ! tar tzf "$BACKUP_DIR/$NAME.partial" >/dev/null 2>&1; then
  echo "$(date '+%F %T') ERRORE: archivio illeggibile, scartato" >&2
  rm -f "$BACKUP_DIR/$NAME.partial"
  exit 1
fi
mv "$BACKUP_DIR/$NAME.partial" "$BACKUP_DIR/$NAME"
chmod 600 "$BACKUP_DIR/$NAME"

find "$BACKUP_DIR" -name 'portfolio-uploads-*.tgz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') OK $(du -h "$BACKUP_DIR/$NAME" | cut -f1) $(tar tzf "$BACKUP_DIR/$NAME" | grep -vc '/$') file $BACKUP_DIR/$NAME"
