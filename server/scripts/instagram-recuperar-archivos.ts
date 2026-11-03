/**
 * Recupera las fotos y los archivos de los privados de Instagram que llegaron
 * antes de que Voltia PM los bajara (1-nov-2026), o cuando falló la bajada: le
 * pide a Meta links nuevos por el id de cada mensaje y los guarda, así se ven en
 * el chat. Meta solo da los mensajes recientes de cada conversación: de los muy
 * viejos puede no devolver nada.
 *
 * Idempotente. Sin --aplicar solo cuenta lo que haría.
 *   npx tsx scripts/instagram-recuperar-archivos.ts            # ensayo
 *   npx tsx scripts/instagram-recuperar-archivos.ts --aplicar
 */

import { prisma } from "../src/lib/prisma.js";
import { recuperarArchivos } from "../src/services/instagram-marketing/archivos.js";
import { adjuntosDeMensaje } from "../src/services/instagram-marketing/meta.js";

const aplicar = process.argv.includes("--aplicar");
const r = await recuperarArchivos({ aplicar, obtener: adjuntosDeMensaje, log: (l) => console.log(l) });
console.log(
  `\n${aplicar ? "Hecho" : "Ensayo (nada guardado)"}: ${r.revisados} mensajes con adjuntos sin archivo, ` +
    `${r.archivos} archivos ${aplicar ? "guardados" : "para bajar"}, ${r.metaSinDatos} sin datos en Meta, ` +
    `${r.sinId} sin id de Meta, ${r.errores} con error.`,
);
await prisma.$disconnect();
