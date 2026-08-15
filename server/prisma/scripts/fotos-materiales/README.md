# Fotos de referencia del catálogo de materiales

Acá viven las fotos que se aplican con
`prisma/scripts/seed-fotos-materiales.ts`, versionadas para que desarrollo y
producción terminen con exactamente las mismas imágenes.

## Cómo agregar una foto

1. Copiar el archivo a esta carpeta (JPG, PNG, WEBP o HEIC; se procesa solo).
2. Sumar una entrada a `manifest.json`:

   ```json
   { "archivo": "panel-resun-580.jpg", "itemId": "cmoh...", "itemNombre": "Paneles Resun 580 W" }
   ```

   `itemId` es lo que se busca primero; `itemNombre` es el fallback y deja
   legible a qué material corresponde.
3. Aplicar:

   ```bash
   docker compose exec server npx tsx prisma/scripts/seed-fotos-materiales.ts --dry-run
   docker compose exec server npx tsx prisma/scripts/seed-fotos-materiales.ts
   ```

En producción se corre el mismo comando después del deploy.

## Sobre el peso

El script reduce a 480px de lado mayor y recomprime a JPEG. Conviene que lo que
se guarda acá ya venga chico (no hace falta subir la foto de 4 MB del celular):
el repo se lleva mejor con archivos de decenas de KB.
