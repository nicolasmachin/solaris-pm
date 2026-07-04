// Lista unificada de propuestas de un lead: mezcla las nuevas
// (ProposalV2Version) con las viejas (ProposalGeneration) en un solo array
// ordenado por fecha DESC, con las acciones aplicables a cada una. Rework modal
// (ver docs/features/proposals-v2/REWORK_MODAL_SPEC.md §4.1).

import { prisma } from "../../lib/prisma.js";
import { listVersions } from "./version.service.js";

export interface ProposalActions {
  canDownloadFull: boolean;
  canDownloadSummary: boolean;
  canDownloadExcel: boolean;
  canPreview: boolean;
  canDiscard: boolean;
  canRestore: boolean;
}

export interface ProposalListItem {
  id: string;
  tipo: "vieja" | "nueva";
  createdAt: string; // ISO
  versionNumber?: number;
  clientName: string;
  status: "activa" | "descartada" | null;
  totalConIva?: number;
  actions: ProposalActions;
}

const NO_ACTIONS: ProposalActions = {
  canDownloadFull: false,
  canDownloadSummary: false,
  canDownloadExcel: false,
  canPreview: false,
  canDiscard: false,
  canRestore: false,
};

// Entradas ya cargadas de BD (así el armado es una función pura, testeable sin DB).
export interface MapProposalsInput {
  versions: Array<{
    id: string;
    versionNumber: number;
    status: "PUBLISHED" | "DISCARDED";
    publishedAt: Date;
    clientName: string | null;
    totalConIva: number | null;
  }>;
  generations: Array<{
    id: string;
    version: number;
    status: string; // ProposalStatus (PENDING/PROCESSING/COMPLETED/FAILED)
    outputFilePath: string | null;
    createdAt: Date;
  }>;
  leadClientName: string;
}

// Arma y mezcla las filas unificadas, ordenadas por fecha DESC. Función pura.
export function mapProposalListItems(input: MapProposalsInput): ProposalListItem[] {
  const nuevas: ProposalListItem[] = input.versions.map((v) => {
    const activa = v.status === "PUBLISHED";
    return {
      id: v.id,
      tipo: "nueva",
      createdAt: v.publishedAt.toISOString(),
      versionNumber: v.versionNumber,
      clientName: v.clientName ?? "",
      status: activa ? "activa" : "descartada",
      totalConIva: v.totalConIva ?? undefined,
      actions: activa
        ? { ...NO_ACTIONS, canDownloadFull: true, canDownloadSummary: true, canPreview: true, canDiscard: true }
        : { ...NO_ACTIONS, canRestore: true },
    };
  });

  const viejas: ProposalListItem[] = input.generations.map((g) => {
    const ready = g.status === "COMPLETED" && Boolean(g.outputFilePath);
    return {
      id: g.id,
      tipo: "vieja",
      createdAt: g.createdAt.toISOString(),
      versionNumber: g.version,
      clientName: input.leadClientName,
      status: null, // las viejas no tienen concepto activa/descartada
      actions: { ...NO_ACTIONS, canDownloadFull: ready, canPreview: ready },
    };
  });

  return [...nuevas, ...viejas].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

// Carga las propuestas del lead y devuelve la lista unificada. `includeDiscarded`
// afecta solo a las nuevas (las viejas no tienen soft-delete y van siempre).
export async function listLeadProposals(
  leadId: string,
  includeDiscarded: boolean,
  leadClientName: string,
): Promise<ProposalListItem[]> {
  const versions = await listVersions(leadId, { includeDiscarded });
  const generations = await prisma.proposalGeneration.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, status: true, outputFilePath: true, createdAt: true },
  });

  return mapProposalListItems({
    versions: versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      status: v.status,
      publishedAt: v.publishedAt,
      clientName: v.clientName,
      totalConIva: v.totalConIva,
    })),
    generations,
    leadClientName,
  });
}
