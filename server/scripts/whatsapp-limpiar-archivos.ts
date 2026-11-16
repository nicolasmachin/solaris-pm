/**
 * Limpieza de archivos de WhatsApp (fotos, audios, videos, documentos): borra
 * los de los mensajes de más de N días. El mensaje queda, con su texto y la
 * transcripción del audio; en el chat se ve "borrado en la limpieza".
 *
 * Uso (en el servidor):
 *   npx tsx scripts/whatsapp-limpiar-archivos.ts --dias 180            → muestra cuánto borraría
 *   npx tsx scripts/whatsapp-limpiar-archivos.ts --dias 180 --aplicar  → borra
 */

import { promises as fs } from "node:fs";

import { prisma } from "../src/lib/prisma.js";
import { getStoredFilePath } from "../src/services/file-storage.service.js";
import { BORRADO_EN_LIMPIEZA } from "../src/services/whatsapp-cloud/media.service.js";

async function main() {
  const i = process.argv.indexOf("--dias");
  const dias = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  if (!Number.isFinite(dias) || dias < 30) {
    console.error("Falta --dias (30 o más).");
    process.exitCode = 1;
    return;
  }
  const aplicar = process.argv.includes("--aplicar");
  const antesDe = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const viejos = await prisma.whatsAppMensaje.findMany({
    where: { archivoPath: { not: null }, ocurridoEn: { lt: antesDe } },
    select: { id: true, archivoPath: true },
  });
  let bytes = 0;
  for (const m of viejos) bytes += (await fs.stat(getStoredFilePath(m.archivoPath!)).catch(() => null))?.size ?? 0;
  console.log(`Archivos de antes del ${antesDe.toISOString().slice(0, 10)}: ${viejos.length} (${(bytes / 1024 / 1024).toFixed(1)} MB).`);
  if (!aplicar) {
    console.log("Sin --aplicar: no se borró nada.");
    return;
  }
  for (const m of viejos) {
    await fs.rm(getStoredFilePath(m.archivoPath!), { force: true });
    await prisma.whatsAppMensaje.update({ where: { id: m.id }, data: { archivoPath: null, archivoError: BORRADO_EN_LIMPIEZA } });
  }
  console.log(`Borrados: ${viejos.length}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
