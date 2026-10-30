/**
 * Carga en Voltia PM el historial de Instagram del servidor de indicadores:
 * las conversaciones del contestador (desde el 28-oct-2026) y la base de
 * contactos con etiquetas (la carga para atrás de ManyChat, ~4.200).
 *
 * Todo queda marcado como importado: se ve en la bandeja y en los contactos,
 * pero no cuenta para las métricas (decisión de Nicolás del 30-oct-2026).
 * Es idempotente: se puede correr de nuevo (por ejemplo al hacer el cambio,
 * para traer lo último que contestó indicadores) sin duplicar nada.
 *
 * Uso, con los archivos copiados al contenedor (en la VPS están en
 * ~/indicadores-voltia/datos/instagram/):
 *   npx tsx scripts/instagram-importar.ts conversaciones /tmp/ig/conversaciones
 *   npx tsx scripts/instagram-importar.ts contactos /tmp/ig/contactos.json
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "../src/lib/prisma.js";
import { guardarDesdeConector } from "../src/services/instagram-marketing/bandeja.service.js";
import { conversacionConectorSchema } from "../src/services/instagram-marketing/conversacion.js";

type ContactoViejo = {
  id: string;
  usuario?: string;
  nombre?: string;
  sigue?: boolean;
  primera_vez: number;
  ultima_vez: number;
  etiquetas: Record<string, { primera: number; ultima: number; veces?: number }>;
};

async function conversaciones(carpeta: string) {
  let n = 0;
  let nuevos = 0;
  for (const archivo of readdirSync(carpeta).filter((a) => a.endsWith(".json")).sort()) {
    const crudo = JSON.parse(readFileSync(join(carpeta, archivo), "utf8"));
    const conv = conversacionConectorSchema.safeParse(crudo);
    if (!conv.success) {
      console.warn(`  ${archivo}: formato inválido, se saltea`);
      continue;
    }
    nuevos += (await guardarDesdeConector({ ...conv.data, ...crudo }, { historial: true })).nuevos;
    n += 1;
  }
  console.log(`Conversaciones: ${n} leídas, ${nuevos} mensajes nuevos.`);
}

const fecha = (s: number) => new Date(s * 1000);

async function contactos(archivo: string) {
  const base = JSON.parse(readFileSync(archivo, "utf8")) as Record<string, ContactoViejo>;
  let creados = 0;
  let existentes = 0;
  for (const c of Object.values(base)) {
    const persona = /^\d+$/.test(c.id) ? c.id : null;
    const usuario = c.usuario?.replace(/^@/, "").toLowerCase() || null;
    if (!persona && !usuario) continue;
    const ya = await prisma.instagramContacto.findFirst({
      where: { OR: [...(persona ? [{ persona }] : []), ...(usuario ? [{ usuario }] : [])] },
    });
    const contacto =
      ya ??
      (await prisma.instagramContacto.create({
        data: {
          persona,
          usuario,
          nombre: c.nombre || null,
          sigue: typeof c.sigue === "boolean" ? c.sigue : null,
          primeraVez: fecha(c.primera_vez),
          ultimaVez: fecha(c.ultima_vez),
          importado: true,
        },
      }));
    if (ya) existentes += 1;
    else creados += 1;
    for (const [nombre, e] of Object.entries(c.etiquetas ?? {})) {
      // Solo si no la tiene: así correrlo dos veces no suma "veces".
      await prisma.instagramContactoEtiqueta.createMany({
        data: [{ contactoId: contacto.id, nombre, primera: fecha(e.primera), ultima: fecha(e.ultima), veces: e.veces ?? 1, importada: true }],
        skipDuplicates: true,
      });
    }
  }
  console.log(`Contactos: ${creados} nuevos, ${existentes} ya estaban (se les sumaron las etiquetas que faltaban).`);
}

async function main() {
  const [que, ruta] = process.argv.slice(2);
  if (que === "conversaciones" && ruta) await conversaciones(ruta);
  else if (que === "contactos" && ruta) await contactos(ruta);
  else {
    console.error("Uso: instagram-importar.ts conversaciones <carpeta> | contactos <contactos.json>");
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
