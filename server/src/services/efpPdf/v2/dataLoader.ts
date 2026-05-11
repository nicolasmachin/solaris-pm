// Carga del input del PDF EFP v2 a partir de un versionId.
// REGLA: lee SIEMPRE de los snapshots (Fase A). NUNCA consulta Project /
// PreIngeniería / Ute / Materials en vivo. Eso garantiza que el PDF de v1
// no muta cuando los datos cambian después de aprobado.

import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../utils/errors.js";
import type {
  SnapshotMaterials,
  SnapshotPreIng,
  SnapshotProject,
  SnapshotUte,
} from "../../efp.snapshots.types.js";
import type { EFPPdfInput, EFPVersionStatus } from "./types.js";

export async function buildEFPPdfInput(versionId: string): Promise<EFPPdfInput> {
  const version = await prisma.eFPVersion.findUnique({
    where: { id: versionId },
    include: {
      efp: {
        include: {
          attachments: {
            where: { deletedAt: null, includeInPdf: true },
            orderBy: { createdAt: "asc" },
            include: {
              fileAttachment: { select: { filename: true } },
            },
          },
        },
      },
    },
  });

  if (!version) {
    throw new AppError(404, "EFP_VERSION_NOT_FOUND", "Versión del EFP no encontrada");
  }
  if (!version.snapshotProject) {
    throw new AppError(
      500,
      "EFP_SNAPSHOT_MISSING",
      "La versión no tiene snapshot. Ejecutar el backfill de Fase A.",
    );
  }

  // Casteos JSON → tipos. Los snapshots se guardaron con esta estructura.
  const project = version.snapshotProject as unknown as SnapshotProject;
  const preIng = version.snapshotPreIng as unknown as SnapshotPreIng | null;
  const ute = version.snapshotUte as unknown as SnapshotUte | null;
  const materials = version.snapshotMaterials as unknown as SnapshotMaterials | null;

  // Potencia total: paneles × potenciaW / 1000. Si falta alguno → null.
  const potenciaTotalKwp =
    preIng?.cantidadPaneles != null && preIng?.potenciaPanelesW != null
      ? Math.round((preIng.cantidadPaneles * preIng.potenciaPanelesW) / 10) / 100
      : null;

  // approvedAt: el schema no guarda el momento exacto de la aprobación. Como
  // proxy: si status=APPROVED, usamos efp.updatedAt (la última transición de
  // status actualiza updatedAt). Si no está APPROVED, null.
  const versionApprovedAt =
    version.efp.status === "APPROVED" ? version.efp.updatedAt.toISOString() : null;

  // Sections con default vacío por si alguna falta en el JSON.
  const rawSections = (version.content ?? {}) as Partial<EFPPdfInput["sections"]>;
  const sections: EFPPdfInput["sections"] = {
    datosGenerales: rawSections.datosGenerales ?? "",
    resumenEjecutivo: rawSections.resumenEjecutivo ?? "",
    analisisSitio: rawSections.analisisSitio ?? "",
    equipamiento: rawSections.equipamiento ?? "",
    disenoElectrico: rawSections.disenoElectrico ?? "",
    disenoMecanico: rawSections.disenoMecanico ?? "",
    anexos: rawSections.anexos ?? "",
  };

  const attachments = version.efp.attachments.map((a, idx) => ({
    label: `Anexo ${String.fromCharCode(65 + idx)}`,
    title: a.description?.trim() || a.fileAttachment?.filename || "(sin nombre)",
    filename: a.fileAttachment?.filename ?? "(sin archivo)",
    category: a.category ?? null,
  }));

  return {
    versionNumber: version.version,
    versionStatus: version.efp.status as EFPVersionStatus,
    versionApprovedAt,
    generatedAt: new Date().toISOString(),
    project,
    preIng,
    ute,
    materials,
    sections,
    computed: {
      potenciaTotalKwp,
      inversor: preIng?.inversor ?? null,
      paneles: {
        cantidad: preIng?.cantidadPaneles ?? null,
        potenciaW: preIng?.potenciaPanelesW ?? null,
      },
    },
    attachments,
  };
}
