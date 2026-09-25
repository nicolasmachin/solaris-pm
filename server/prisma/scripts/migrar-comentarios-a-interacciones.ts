/**
 * Convierte en contactos de Experiencia Solar los comentarios que Alejandra dejó
 * en los proyectos.
 *
 * Qué pasó: el semáforo de "días sin contacto" se calcula **sólo** con la
 * bitácora de interacciones. Los comentarios del proyecto se ven en el historial
 * del cliente pero no cuentan. Alejandra pasó a registrar sus contactos como
 * comentarios (su última interacción de bitácora es del 11-09; desde entonces son
 * todos comentarios), así que decenas de clientes contactados figuran como "sin
 * contacto" y encabezan el correo de la mañana.
 *
 * Qué hace: por cada comentario suyo en un proyecto, crea una `ClientInteraction`
 * **con la fecha original del comentario**. La fecha es lo único que importa para
 * el semáforo: crearlas con fecha de hoy sería igual de falso, al revés.
 *
 * Qué NO convierte (`NO_SON_CONTACTO`): los comentarios que no describen un
 * intercambio con el cliente sino una nota interna o un estado ("subí el
 * certificado", "estamos esperando el ok del banco"). Convertirlos apagaría el
 * semáforo de un cliente al que nadie le habló, que es exactamente el problema
 * que esto viene a arreglar.
 *
 * Los campos que no se pueden saber se dejan explícitos en vez de inventados:
 *   - `channel: OTRO` — el comentario no dice si fue WhatsApp, llamada o visita.
 *   - `direction: SALIENTE` — la mayoría son avisos nuestros; no se adivina caso
 *     por caso porque errar la dirección es peor que dejar el valor más común.
 *   - `reason: SEGUIMIENTO`.
 *
 * Es idempotente: no crea una interacción si ya existe una con el mismo proyecto,
 * autor y texto.
 *
 *   # ver qué haría, sin tocar nada:
 *   docker compose exec server npx tsx prisma/scripts/migrar-comentarios-a-interacciones.ts
 *   # aplicar:
 *   docker compose exec server npx tsx prisma/scripts/migrar-comentarios-a-interacciones.ts --apply
 */

import { InteractionChannel, InteractionDirection, InteractionReason, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Por nombre completo y excluyendo a los usuarios de portal: hay una clienta que
// también se llama Alejandra, y una búsqueda por "Alejandra" a secas la agarraba.
const AUTOR = "Alejandra Yañez";

/**
 * Comienzos de comentario que NO son un contacto con el cliente. Se comparan por
 * prefijo sobre el texto normalizado; son los ocho casos revisados a mano.
 */
const NO_SON_CONTACTO = [
  "subí el certificado a",
  "este cliente no está en agenda de gabriel",
  "se reanudó el trabajo en esta obra",
  "estamos esperando el ok del banco",
  "aprobado el prestamo por el banco",
  "gracias gabriel por registrar la sugerencia",
  "antonella tiene auto electrico",
  "esta obra tiene tentativa para el 26 de octubre",
];

const normalizar = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function esContacto(contenido: string): boolean {
  const t = normalizar(contenido);
  return !NO_SON_CONTACTO.some((p) => t.startsWith(p));
}

async function main(): Promise<void> {
  const candidatos = await prisma.user.findMany({
    where: {
      name: { contains: AUTOR, mode: "insensitive" },
      deletedAt: null,
      role: { name: { not: "CLIENT" } },
    },
    select: { id: true, name: true, role: { select: { name: true } } },
  });
  if (candidatos.length !== 1) {
    throw new Error(
      `Se esperaba un solo usuario interno "${AUTOR}" y hay ${candidatos.length}: ` +
        candidatos.map((c) => `${c.name} (${c.role.name})`).join(", "),
    );
  }
  const autor = candidatos[0];
  console.log(`Autor: ${autor.name} (${autor.role.name})`);

  const comentarios = await prisma.comment.findMany({
    where: {
      authorId: autor.id,
      deletedAt: null,
      projectId: { not: null },
      project: { deletedAt: null },
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      projectId: true,
      project: { select: { clientName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const contactos = comentarios.filter((c) => esContacto(c.content));
  const descartados = comentarios.filter((c) => !esContacto(c.content));

  console.log(`Comentarios de ${autor.name} en proyectos: ${comentarios.length}`);
  console.log(`  → se convierten: ${contactos.length}`);
  console.log(`  → se dejan como están (no son contacto): ${descartados.length}`);
  for (const d of descartados) {
    console.log(`      · ${d.project?.clientName ?? "—"}: ${d.content.slice(0, 70).replace(/\n/g, " ")}`);
  }

  // Ya migrados en una corrida anterior (mismo proyecto, autor y texto).
  const yaExisten = await prisma.clientInteraction.findMany({
    where: { authorId: autor.id, deletedAt: null },
    select: { projectId: true, content: true },
  });
  const clave = (projectId: string, content: string) => `${projectId}|${normalizar(content)}`;
  const existentes = new Set(yaExisten.map((i) => clave(i.projectId, i.content)));
  const nuevos = contactos.filter((c) => !existentes.has(clave(c.projectId!, c.content)));

  console.log(`  → nuevos a crear (los demás ya estaban migrados): ${nuevos.length}`);

  const proyectos = new Set(nuevos.map((c) => c.projectId!));
  console.log(`  → proyectos alcanzados: ${proyectos.size}`);

  if (!APPLY) {
    console.log("\n(simulación — nada se tocó; agregá --apply para aplicarlo)");
    return;
  }

  for (const c of nuevos) {
    await prisma.clientInteraction.create({
      data: {
        projectId: c.projectId!,
        authorId: autor.id,
        channel: InteractionChannel.OTRO,
        direction: InteractionDirection.SALIENTE,
        reason: InteractionReason.SEGUIMIENTO,
        content: c.content,
        // La fecha original es lo único que importa para el semáforo.
        createdAt: c.createdAt,
      },
    });
  }

  console.log(`\nCreadas ${nuevos.length} interacciones en ${proyectos.size} proyectos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
