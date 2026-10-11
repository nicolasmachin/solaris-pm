/**
 * Crea los adjuntos del proyecto (FileAttachment) para los contratos, proformas
 * y condiciones del Plan de Protección contra Granizo que se generaron antes de
 * que la publicación los copiara a Documentos (11-oct-2026).
 *
 * Por cada proyecto con versiones de esos documentos, deja en Documentos la
 * versión vigente (la última publicada y no descartada), copiando su PDF desde
 * `pdfPath`. Es el mismo `sincronizarDocumentoGenerado()` que corre al publicar,
 * así que es idempotente: correrlo dos veces no duplica nada.
 *
 *   # ver qué haría, sin tocar nada:
 *   docker compose exec server npx tsx prisma/scripts/backfill-documentos-generados.ts
 *   # aplicar:
 *   docker compose exec server npx tsx prisma/scripts/backfill-documentos-generados.ts --apply
 *
 * Reporta cuántos crearía, cuántos ya estaban y los PDF que no encuentra en disco
 * (esos no se tocan: hay que regenerar la versión desde la herramienta).
 */

import { PrismaClient } from "@prisma/client";

import {
  DOCUMENTOS_GENERADOS,
  sincronizarDocumentoGenerado,
  type DocumentoGenerado,
} from "../../src/services/documentos-generados.service.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function proyectosCon(kind: DocumentoGenerado): Promise<string[]> {
  const args = { distinct: ["projectId" as const], select: { projectId: true } };
  const rows =
    kind === "contrato"
      ? await prisma.contractVersion.findMany(args)
      : kind === "proforma"
        ? await prisma.proformaVersion.findMany(args)
        : await prisma.planGranizoVersion.findMany(args);
  return rows.map((r) => r.projectId);
}

async function main() {
  console.log(APPLY ? "Modo APLICAR\n" : "Simulación (agregá --apply para guardar)\n");

  for (const kind of DOCUMENTOS_GENERADOS) {
    const proyectos = await proyectosCon(kind);
    const cuenta = { creado: 0, "ya-estaba": 0, "sin-version": 0, "pdf-faltante": 0 };
    const faltantes: string[] = [];
    let retirados = 0;

    for (const projectId of proyectos) {
      const r = await sincronizarDocumentoGenerado(kind, projectId, { dryRun: !APPLY });
      cuenta[r.accion]++;
      if (r.accion === "pdf-faltante") faltantes.push(`  proyecto ${projectId} · v${r.versionNumber} · ${r.pdfPath}`);
      if (r.accion === "sin-version") retirados += r.retirados;
    }

    console.log(`── ${kind}: ${proyectos.length} proyectos con versiones`);
    console.log(`   ${APPLY ? "creados" : "a crear"}: ${cuenta.creado}`);
    console.log(`   ya estaban: ${cuenta["ya-estaba"]}`);
    console.log(`   sin versión vigente (todas descartadas): ${cuenta["sin-version"]}${retirados ? ` (${retirados} adjuntos retirados)` : ""}`);
    console.log(`   PDF no encontrado en disco: ${cuenta["pdf-faltante"]}`);
    for (const f of faltantes) console.log(f);
    console.log("");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
