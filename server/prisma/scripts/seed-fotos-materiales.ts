// Carga masiva de las fotos de referencia del catálogo de materiales.
//
// Por qué existe: las fotos se van juntando de a poco (alguien saca una en el
// depósito, otra sale de la web del proveedor) y tienen que terminar iguales en
// desarrollo y en producción. En vez de subirlas dos veces a mano, se versionan
// en el repo junto a un manifiesto y este script las aplica al entorno donde se
// corra. En prod se corre después del deploy, igual que el resto de los seeds:
//
//   docker compose exec server npx tsx prisma/scripts/seed-fotos-materiales.ts
//
// Idempotente: si el ítem ya tiene exactamente esa misma imagen (comparación por
// hash del archivo ya procesado), no toca nada. Correrlo dos veces no duplica
// archivos ni cambia `fotoUpdatedAt`, que es lo que invalida el cache del
// navegador.
//
// Flags:
//   --dry-run   muestra qué haría, sin escribir nada
//
// El manifiesto es `fotos-materiales/manifest.json`:
//
//   [
//     { "archivo": "panel-resun-580.jpg", "itemId": "cmoh...", "itemNombre": "Paneles Resun 580 W" }
//   ]
//
// `itemId` es lo que se usa primero (la base local es copia de prod, así que los
// ids coinciden); `itemNombre` es el fallback y sirve de documentación legible.

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  deleteMaterialPhotoFile,
  guardarFotoMaterialProcesada,
  materialPhotoAbsolutePath,
  procesarFotoMaterial,
} from "../../src/services/material-photo.service.js";

const prisma = new PrismaClient();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const FOTOS_DIR = path.join(scriptDir, "fotos-materiales");
const MANIFEST = path.join(FOTOS_DIR, "manifest.json");

interface EntradaManifiesto {
  archivo: string;
  itemId?: string;
  itemNombre?: string;
}

function hash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  let manifiesto: EntradaManifiesto[];
  try {
    manifiesto = JSON.parse(await fs.readFile(MANIFEST, "utf8")) as EntradaManifiesto[];
  } catch {
    console.log(`No hay manifiesto en ${MANIFEST} — nada que hacer.`);
    return;
  }

  let aplicadas = 0;
  let sinCambios = 0;
  const problemas: string[] = [];

  for (const entrada of manifiesto) {
    const etiqueta = entrada.itemNombre ?? entrada.itemId ?? entrada.archivo;

    const item = entrada.itemId
      ? await prisma.materialItem.findUnique({ where: { id: entrada.itemId } })
      : null;
    const porNombre =
      item ??
      (entrada.itemNombre
        ? await prisma.materialItem.findFirst({
            where: { nombre: { equals: entrada.itemNombre, mode: "insensitive" } },
          })
        : null);

    if (!porNombre) {
      problemas.push(`✗ ${etiqueta}: no existe ese ítem en el catálogo de este entorno`);
      continue;
    }

    let original: Buffer;
    try {
      original = await fs.readFile(path.join(FOTOS_DIR, entrada.archivo));
    } catch {
      problemas.push(`✗ ${etiqueta}: falta el archivo ${entrada.archivo}`);
      continue;
    }

    let procesada: Buffer;
    try {
      procesada = await procesarFotoMaterial(original, { filename: entrada.archivo });
    } catch (err) {
      problemas.push(`✗ ${etiqueta}: ${(err as Error).message}`);
      continue;
    }

    // ¿Ya tiene exactamente esta imagen? Se compara el resultado procesado, no
    // el original: así el script es estable aunque se recomprima el fuente.
    if (porNombre.fotoPath) {
      const actual = await fs
        .readFile(materialPhotoAbsolutePath(porNombre.fotoPath))
        .catch(() => null);
      if (actual && hash(actual) === hash(procesada)) {
        sinCambios++;
        continue;
      }
    }

    if (dryRun) {
      console.log(`→ ${porNombre.nombre}: se ${porNombre.fotoPath ? "reemplazaría" : "cargaría"} la foto (${Math.round(procesada.length / 1024)} KB)`);
      aplicadas++;
      continue;
    }

    const guardada = await guardarFotoMaterialProcesada(procesada);
    const anterior = porNombre.fotoPath;
    await prisma.materialItem.update({
      where: { id: porNombre.id },
      data: { fotoPath: guardada.relativePath, fotoUpdatedAt: new Date() },
    });
    // Igual que en la subida por la app: la vieja se borra recién cuando la
    // nueva quedó escrita y referenciada.
    if (anterior && anterior !== guardada.relativePath) {
      await deleteMaterialPhotoFile(anterior);
    }

    console.log(`✓ ${porNombre.nombre} (${Math.round(guardada.sizeBytes / 1024)} KB)`);
    aplicadas++;
  }

  console.log(
    `\n${dryRun ? "[dry-run] " : ""}${aplicadas} foto(s) aplicada(s), ${sinCambios} ya estaba(n) al día, ${problemas.length} con problemas.`,
  );
  for (const p of problemas) console.log(p);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
