#!/bin/bash
set -eo pipefail

DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="$HOME/Backups/voltia-pm"
# Copia en Google Drive vía rclone (remoto "gdrive", configurado en la VPS de desarrollo)
DRIVE_DIR="gdrive:Backups Voltia PM"
FILENAME="voltiapm_backup_$DATE.sql.gz"
REPO_ROOT="$(git rev-parse --show-toplevel)"

echo "==============================="
echo "VOLTIA PM — Guardado completo"
echo "==============================="

echo ""
echo "1/3 — Backup de base de datos..."
mkdir -p "$BACKUP_DIR"

docker compose exec -T postgres pg_dump \
  -U voltia voltia_pm | gzip > "$BACKUP_DIR/$FILENAME"

if [ ! -s "$BACKUP_DIR/$FILENAME" ]; then
  echo "ERROR: El backup quedó vacío. Abortando."
  rm -f "$BACKUP_DIR/$FILENAME"
  exit 1
fi

FILESIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "Backup guardado: $FILENAME ($FILESIZE)"

find "$BACKUP_DIR" -name "voltiapm_backup_*.sql.gz" \
  -mtime +30 -delete

if command -v rclone >/dev/null && rclone listremotes 2>/dev/null | grep -q '^gdrive:$'; then
  if rclone copy "$BACKUP_DIR/$FILENAME" "$DRIVE_DIR" 2>/dev/null; then
    echo "Copia subida a Google Drive."
    rclone delete "$DRIVE_DIR" --min-age 30d --include "voltiapm_backup_*.sql.gz" 2>/dev/null || true
  else
    echo "AVISO: no se pudo subir a Google Drive. El backup quedó solo en $BACKUP_DIR."
  fi
else
  echo "AVISO: rclone/gdrive no configurado. El backup quedó solo en $BACKUP_DIR."
fi

echo ""
echo "2/3 — Commit de cambios..."
cd "$REPO_ROOT"
git add -A

if git diff --cached --quiet; then
  echo "Sin cambios nuevos para commitear."
else
  git commit -m "chore: guardado automático $DATE"
  echo "Commit creado."
fi

echo ""
echo "3/3 — Push a GitHub..."
git push
echo "Push completado."

echo ""
echo "==============================="
echo "Todo guardado correctamente."
echo "==============================="
