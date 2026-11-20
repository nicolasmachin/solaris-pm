/**
 * Crea los adjuntos del proyecto (FileAttachment) para las cédulas y facturas
 * de UTE que se subieron antes de que la subida las dejara en Documentos
 * (20-nov-2026). Hasta entonces se guardaban en el server y la IA las leía, pero
 * no había dónde descargarlas.
 *
 * Recorre los proyectos con `cedulaPath` / `facturaUtePath` (suministro
 * principal) y las configs UTE de los demás suministros. Usa el mismo
 * `sincronizarDocumentoCliente()` que corre al subir, así que es idempotente.
 * Como "subido por" toma a quien hizo la última extracción con IA de ese
 * documento (auditoría); si no la encuentra, a quien creó el proyecto.
 *
 *   # ver qué haría, sin tocar nada:
 *   docker compose exec server npx tsx prisma/scripts/backfill-documentos-cliente.ts
 *   # aplicar:
 *   docker compose exec server npx tsx prisma/scripts/backfill-documentos-cliente.ts --apply
 */

import { PrismaClient } from "@prisma/client";

import {
  sincronizarDocumentoCliente,
  type DocumentoCliente,
  type ResultadoDocumentoCliente,
} from "../../src/services/documentos-cliente.service.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Caso = { projectId: string; tipo: DocumentoCliente; suministro: number };

async function casos(): Promise<Caso[]> {
  const lista: Caso[] = [];
  const proyectos = await prisma.project.findMany({
    where: { deletedAt: null, OR: [{ cedulaPath: { not: null } }, { facturaUtePath: { not: null } }] },
    select: { id: true, cedulaPath: true, facturaUtePath: true },
  });
  for (const p of proyectos) {
    if (p.cedulaPath) lista.push({ projectId: p.id, tipo: "cedula", suministro: 1 });
    if (p.facturaUtePath) lista.push({ projectId: p.id, tipo: "factura_ute", suministro: 1 });
  }
  const configs = await prisma.uteDocumentConfig.findMany({
    where: {
      suministro: { gt: 1 },
      project: { deletedAt: null },
      OR: [{ cedulaPath: { not: null } }, { facturaUtePath: { not: null } }],
    },
    select: { projectId: true, suministro: true, cedulaPath: true, facturaUtePath: true },
  });
  for (const c of configs) {
    if (c.cedulaPath) lista.push({ projectId: c.projectId, tipo: "cedula", suministro: c.suministro });
    if (c.facturaUtePath) lista.push({ projectId: c.projectId, tipo: "factura_ute", suministro: c.suministro });
  }
  return lista;
}

async function quienSubio(c: Caso): Promise<string | undefined> {
  const entradas = await prisma.auditLog.findMany({
    where: { projectId: c.projectId, metadata: { path: ["kind"], equals: "ute_extract" } },
    orderBy: { timestamp: "desc" },
    select: { userId: true, metadata: true },
  });
  const e = entradas.find((x) => {
    const m = x.metadata as { tipo?: string; suministro?: number } | null;
    return m?.tipo === c.tipo && (m?.suministro ?? 1) === c.suministro;
  });
  return e?.userId;
}

async function main() {
  console.log(APPLY ? "Modo APLICAR\n" : "Simulación (agregá --apply para guardar)\n");
  const lista = await casos();
  const cuenta: Record<ResultadoDocumentoCliente, number> = {
    creado: 0,
    "ya-estaba": 0,
    retirado: 0,
    "sin-documento": 0,
    "archivo-faltante": 0,
  };
  const faltantes: string[] = [];

  for (const c of lista) {
    const userId = await quienSubio(c);
    const r = await sincronizarDocumentoCliente(c.projectId, c.tipo, c.suministro, { userId, dryRun: !APPLY });
    cuenta[r]++;
    if (r === "archivo-faltante") faltantes.push(`  proyecto ${c.projectId} · ${c.tipo} · suministro ${c.suministro}`);
  }

  console.log(`Documentos de cliente encontrados: ${lista.length}`);
  console.log(`  ${APPLY ? "creados" : "a crear"}: ${cuenta.creado}`);
  console.log(`  ya estaban: ${cuenta["ya-estaba"]}`);
  console.log(`  archivo no encontrado en disco: ${cuenta["archivo-faltante"]}`);
  for (const f of faltantes) console.log(f);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
