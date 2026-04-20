#!/bin/bash
set -eo pipefail

DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="/Users/nicolasmachin/Library/CloudStorage/OneDrive-Personal/1. Voltia/Cosas Nico/Backups"
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
