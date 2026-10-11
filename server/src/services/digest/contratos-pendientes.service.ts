/**
 * Contratos generados que todavía no tienen el firmado cargado, por asesor.
 *
 * Alimenta la sección "Contratos pendientes de firma" del resumen diario por mail
 * (`daily-digest.job.ts`). Decisión de Nicolás (11-oct-2026): el contrato firmado
 * NO bloquea ninguna subetapa; en vez de eso, a cada asesor le llega todos los
 * días la lista de los suyos que faltan, hasta que los sube.
 *
 * Qué cuenta como pendiente:
 *   - el proyecto tiene al menos una versión de contrato publicada (no descartada);
 *   - no tiene ningún adjunto vigente con toolSource "contrato-firmado";
 *   - el proyecto no está borrado ni archivado, ni es un generador liviano
 *     importado por CSV.
 *
 * Quién es "el asesor": `Project.salespersonId` (se completa al convertir el
 * lead) y, si estuviera vacío, el asignado del lead convertido.
 */

import { ContractVersionStatus, ProjectStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { TOOL_SOURCE_CONTRATO_FIRMADO } from "../documentos-generados.service.js";

const DIA_MS = 24 * 60 * 60 * 1000;

export type ContratoPendiente = {
  projectId: string;
  cliente: string;
  /** Días desde que se generó la última versión publicada del contrato. */
  dias: number;
};

export async function contratosPendientesPorAsesor(
  now: Date = new Date(),
): Promise<Map<string, ContratoPendiente[]>> {
  const proyectos = await prisma.project.findMany({
    where: {
      deletedAt: null,
      status: { not: ProjectStatus.ARCHIVED },
      importedFromCsv: false,
      contractVersions: { some: { status: ContractVersionStatus.PUBLISHED } },
      files: { none: { toolSource: TOOL_SOURCE_CONTRATO_FIRMADO, deletedAt: null } },
    },
    select: {
      id: true,
      clientName: true,
      salespersonId: true,
      convertedLeads: { select: { assignedToId: true }, take: 1 },
      contractVersions: {
        where: { status: ContractVersionStatus.PUBLISHED },
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: { publishedAt: true },
      },
    },
  });

  const porAsesor = new Map<string, ContratoPendiente[]>();
  for (const p of proyectos) {
    const asesorId = p.salespersonId ?? p.convertedLeads[0]?.assignedToId ?? null;
    const ultimo = p.contractVersions[0]?.publishedAt;
    if (!asesorId || !ultimo) continue;
    const lista = porAsesor.get(asesorId) ?? [];
    lista.push({
      projectId: p.id,
      cliente: p.clientName,
      dias: Math.max(0, Math.floor((now.getTime() - ultimo.getTime()) / DIA_MS)),
    });
    porAsesor.set(asesorId, lista);
  }
  // Lo más viejo primero: es lo que se viene arrastrando.
  for (const lista of porAsesor.values()) lista.sort((a, b) => b.dias - a.dias);
  return porAsesor;
}
