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

## Una foto puede ir a varios ítems

Cuando el mismo material está cargado con varias medidas (los perfiles en 3.600
y 4.800, el cable de aluminio en 50/75/95 mm², los termomagnéticos por amperaje),
la sección o el cuerpo se ven idénticos: se repite la misma entrada del
manifiesto cambiando el `itemId`. Cada ítem termina con su propio archivo en el
storage, así que quitarle la foto a uno no afecta a los demás.

## De dónde salen los archivos

Las fotos crudas del celular se dejan en `server/scripts/fotos-materiales/` (esa
carpeta está en el `.gitignore`: son HEIC de 1-2 MB) y se pasan a esta con:

```bash
docker compose exec server npx tsx scripts/procesar-fotos-entrada.ts IMG_1234.HEIC=nombre-descriptivo
```

## Pendientes

- `medidor-eastron-sdm230.jpg` está procesada pero **sin entrada en el
  manifiesto**: el catálogo no tiene todavía un ítem para el medidor Eastron
  SDM230-Modbus. Cuando se cree, agregar la entrada y correr el script.

## Sobre el peso

El script reduce a 480px de lado mayor y recomprime a JPEG. Conviene que lo que
se guarda acá ya venga chico (no hace falta subir la foto de 4 MB del celular):
el repo se lleva mejor con archivos de decenas de KB.
