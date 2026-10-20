/**
 * Saca las copias repetidas de la minuta en los proyectos.
 *
 *   docker compose exec server npx tsx scripts/limpiar-minutas-repetidas.ts <email-usuario> [--aplicar]
 *
 * Hasta el 19-oct-2026, "completar desde la minuta" en Pre-ingeniería guardaba
 * el PDF otra vez aunque el proyecto ya lo tuviera (la minuta del asesor viene
 * copiada del lead al ganar la venta), y cada reintento sumaba otra copia. Esto
 * agrupa, en cada proyecto, los PDFs de minuta con el mismo contenido (mismo
 * tamaño y mismos bytes) y deja uno: el que usó alguna versión de la
 * pre-ingeniería, y si ninguno, el más viejo. Los demás se marcan como borrados
 * (deletedAt), con su entrada en el historial; el archivo físico no se toca, así
 * que se puede deshacer. Sin --aplicar solo muestra lo que haría.
 */

import { AuditAction, AuditEntityType, FileAttachmentTipo } from "@prisma/client";
import { promises as fs } from "node:fs";

import { prisma } from "../src/lib/prisma.js";
import { createAuditEntry } from "../src/services/audit.service.js";
import { getStoredFilePath } from "../src/services/file-storage.service.js";

async function main() {
  const [email] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const aplicar = process.argv.includes("--aplicar");
  if (!email) throw new Error("Uso: limpiar-minutas-repetidas.ts <email-usuario> [--aplicar]");
  const usuario = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!usuario) throw new Error(`No existe el usuario ${email}`);

  const minutas = await prisma.fileAttachment.findMany({
    where: {
      projectId: { not: null },
      deletedAt: null,
      mimeType: "application/pdf",
      OR: [
        { tipo: FileAttachmentTipo.MINUTA_RELEVAMIENTO },
        { filename: { contains: "minuta", mode: "insensitive" } },
        { filename: { contains: "resumen de visita", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, projectId: true, filename: true, sizeBytes: true, url: true, createdAt: true,
      project: { select: { code: true, clientName: true } },
      _count: { select: { preIngenieriaMinutaFor: true } },
    },
  });

  // Por proyecto y tamaño; dentro, por contenido.
  const grupos = new Map<string, typeof minutas>();
  for (const m of minutas) {
    const k = `${m.projectId}|${m.sizeBytes}`;
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }

  let sobran = 0;
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    const porContenido: { bytes: Buffer | null; items: typeof minutas }[] = [];
    for (const m of lista) {
      const bytes = await fs.readFile(getStoredFilePath(m.url)).catch(() => null);
      const g = bytes && porContenido.find((x) => x.bytes && x.bytes.equals(bytes));
      if (g) g.items.push(m);
      else porContenido.push({ bytes, items: [m] });
    }
    for (const { bytes, items } of porContenido) {
      if (items.length < 2 || !bytes) continue;
      const queda = items.find((i) => i._count.preIngenieriaMinutaFor > 0) ?? items[0];
      const fuera = items.filter((i) => i.id !== queda.id);
      sobran += fuera.length;
      console.log(`${queda.project?.code} ${queda.project?.clientName} — queda "${queda.filename}" (${queda.createdAt.toISOString().slice(0, 10)}), sobran ${fuera.length}`);
      if (!aplicar) continue;
      for (const f of fuera) {
        await prisma.fileAttachment.update({ where: { id: f.id }, data: { deletedAt: new Date() } });
        await createAuditEntry({
          entityType: AuditEntityType.file,
          entityId: f.id,
          projectId: f.projectId!,
          userId: usuario.id,
          action: AuditAction.deleted,
          description: `Se sacó una copia repetida de la minuta "${f.filename}" (queda la del ${queda.createdAt.toISOString().slice(0, 10)})`,
          metadata: { kind: "minuta_duplicada", conservada: queda.id },
        });
      }
    }
  }
  console.log(`\n${sobran} copias de más${aplicar ? " marcadas como borradas" : " (simulación: correr con --aplicar)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
