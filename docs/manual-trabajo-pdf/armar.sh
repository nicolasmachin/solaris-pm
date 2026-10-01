#!/usr/bin/env bash
# Genera las hojas del PGT desde el .md, las mide y saca vistas previas.
#
#   bash docs/manual-trabajo-pdf/armar.sh <carpeta> [Hoja1.dc.html,Hoja2.dc.html]
#
# Deja <carpeta>/project/ (lo que se publica al canvas) y, si se pasan hojas,
# sus PNG en <carpeta>/vistas/. Todo lo que copia al contenedor va a /tmp, no a
# /app: /app es la carpeta server/ del repo y lo que cae ahí se commitea.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="$1"
VISTAS="${2:-}"

rm -rf "$OUT/project"
mkdir -p "$OUT"
docker compose exec -T server sh -c 'rm -rf /tmp/mt && mkdir -p /tmp/mt'

# 1. Se miden los bloques con las fuentes reales, y con eso se cortan las hojas.
python3 docs/manual-trabajo-pdf/contenido.py --bloques "$OUT/bloques.json"
docker compose cp "$OUT/bloques.json" server:/tmp/mt/bloques.json >/dev/null
docker compose cp docs/manual-trabajo-pdf/medir-bloques.mjs server:/app/medir-bloques-mt.mjs >/dev/null
docker compose exec -T -w /app server node medir-bloques-mt.mjs /tmp/mt/bloques.json /tmp/mt/alturas.json
docker compose cp server:/tmp/mt/alturas.json "$OUT/alturas.json" >/dev/null
python3 docs/manual-trabajo-pdf/contenido.py "$OUT" --alturas "$OUT/alturas.json"

docker compose cp "$OUT/project" server:/tmp/mt/paginas >/dev/null
docker compose cp docs/manual-trabajo-pdf/imagenes server:/tmp/mt/imagenes >/dev/null
docker compose cp docs/manual-trabajo-pdf/assets-locales.json server:/tmp/mt/assets-locales.json >/dev/null
# Los .mjs tienen que estar dentro de /app para encontrar puppeteer (un symlink
# no alcanza: Node resuelve desde la ruta real). Se borran al final.
docker compose cp docs/manual-posventa-pdf/espacio.mjs server:/app/espacio-mt.mjs >/dev/null
docker compose cp docs/manual-posventa-pdf/vista-previa.mjs server:/app/vista-mt.mjs >/dev/null
ENV="-e DIR_IMAGENES=/tmp/mt/imagenes -e MAPA_ASSETS=/tmp/mt/assets-locales.json"

echo "── medición (1123 y ok = entra) ──"
docker compose exec -T -w /app $ENV server node espacio-mt.mjs /tmp/mt/paginas

if [ -n "$VISTAS" ]; then
  docker compose exec -T -w /app $ENV server node vista-mt.mjs /tmp/mt/paginas /tmp/mt/vistas "$VISTAS" >/dev/null
  rm -rf "$OUT/vistas"
  docker compose cp server:/tmp/mt/vistas "$OUT/vistas" >/dev/null
  echo "── vistas en $OUT/vistas ──"
  ls "$OUT/vistas"
fi
docker compose exec -T server sh -c 'rm -f /app/espacio-mt.mjs /app/vista-mt.mjs /app/medir-bloques-mt.mjs'
