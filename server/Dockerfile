FROM node:20-bookworm-slim

# Dependencias del sistema:
# - openssl: requerido por Prisma
# - python3 + venv + pip: generador de propuestas comerciales (PDF)
# - libfreetype6 + libjpeg62-turbo: necesarios por matplotlib/Pillow runtime
# - chromium: requerido por Puppeteer para el generador EFP (Fase B). Se usa
#   el Chromium de apt en lugar del bundled de Puppeteer porque éste último
#   solo distribuye binarios x86_64 — en entornos ARM64 (Apple Silicon Docker)
#   el bundled crashea con rosetta error. apt trae arm64 nativo. PUPPETEER_SKIP_DOWNLOAD
#   y PUPPETEER_EXECUTABLE_PATH coordinan que la lib npm no intente descargar.
# - fonts-liberation: tipos genéricos para que el PDF renderice bien aun si
#   el CSS pide Inter y la red no carga Google Fonts.
# - ffmpeg: comprime los videos de ensayos que sube Operaciones. Un video crudo
#   de celular pesa ~150 MB/min; recomprimido a H.264 720p queda en ~12 MB/min.
#   Trae también ffprobe (metadata del original) y libzimg/zscale, necesario para
#   convertir a SDR el HDR de los iPhone. El de Debian se usa en vez de un build
#   estático de terceros porque recibe parches de seguridad.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       openssl \
       ca-certificates \
       python3 \
       python3-venv \
       python3-pip \
       libfreetype6 \
       libjpeg62-turbo \
       libpng16-16 \
       fonts-liberation \
       ffmpeg \
       chromium \
       chromium-sandbox \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Virtualenv aislado para el generador de propuestas. Vivir fuera de /app
# evita que el bind mount del dev compose lo borre.
RUN python3 -m venv /opt/proposal-venv \
  && /opt/proposal-venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/proposal-venv/bin/pip install --no-cache-dir \
       reportlab==4.0.7 \
       PyPDF2==3.0.1 \
       pycryptodome==3.23.0 \
       matplotlib==3.8.2 \
       pandas==2.1.4 \
       openpyxl==3.1.2

ENV PROPOSAL_PYTHON=/opt/proposal-venv/bin/python3

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]
