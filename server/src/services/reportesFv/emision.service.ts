// Emisión de un reporte: genera el PDF de un periodo, lo guarda como
// FileAttachment y crea una ReporteFvEmision versionada.
//
// Cada emisión referencia el ReporteFvCalculo del periodo (que debe existir:
// se recalcula antes si hace falta) y guarda el view-model completo como
// snapshot, para que el PDF se reproduzca idéntico aunque después cambien las
// tarifas, la config o el motor. Regenerar crea una versión nueva —igual que
// UnifilarVersion/EFPVersion—; sólo la última es la vigente.

import { FileAttachmentTipo, type Prisma, ReporteFvEmisionEstado, ReporteFvFuente } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { createAuditEntry } from "../audit.service.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { buildToolGeneratedFilename, saveBufferAsAttachment } from "../file-storage.service.js";
import { computarSerieDeProyecto, recalcularSerieConConfig } from "./calculo.service.js";
import { exigirConfigCompleta, getConfigEfectiva } from "./config.service.js";
import { generarReporteFvPdf } from "./pdf/index.js";
import { construirPdfInput, contextoDesdeConfig } from "./pdf/viewModel.js";
import type { ReporteFvPdfInput } from "./pdf/types.js";
import { COBERTURA_MINIMA } from "./growatt/ingesta.service.js";
import { periodoADate, periodoCerrado, type Periodo } from "./periodo.js";

const TOOL_SOURCE = "reporte-fv";

export interface ResultadoEmision {
  emisionId: string;
  version: number;
  fileAttachmentId: string;
  bytes: number;
}

/**
 * Genera (o regenera) la emisión de un periodo para un proyecto.
 *
 * - Exige config calculable (potencia, franjas, tarifa de empresa).
 * - Asegura que exista el ReporteFvCalculo del periodo (recalcula la serie).
 * - Genera el PDF, lo guarda, y crea una ReporteFvEmision con versión N+1.
 */
export async function generarEmision(
  projectId: string,
  periodo: Periodo,
  userId: string,
): Promise<ResultadoEmision> {
  const config = exigirConfigCompleta(await getConfigEfectiva(projectId));
  if (!periodoCerrado(periodo, config.diaCorteMedidor)) {
    throw badRequest(
      "REPORTE_FV_PERIODO_ABIERTO",
      `El período ${periodo} de ${config.clientName} todavía no terminó: se puede emitir recién al día siguiente del cierre`,
    );
  }

  // Recalcula y persiste la serie completa (idempotente): garantiza que el
  // ReporteFvCalculo del periodo esté al día antes de emitir.
  await recalcularSerieConConfig(config);

  const { serie } = await computarSerieDeProyecto(config);
  const resultado = serie.find((r) => r.periodo === periodo);
  if (!resultado) {
    throw notFound("REPORTE_FV_SIN_PERIODO", `No hay datos para ${config.clientName} en ${periodo}`);
  }
  if (resultado.omitido) {
    throw badRequest("REPORTE_FV_PERIODO_OMITIDO", `${periodo}: ${resultado.omitido}`);
  }

  const calculo = await prisma.reporteFvCalculo.findUnique({
    where: { projectId_periodo: { projectId, periodo: periodoADate(periodo) } },
    select: { id: true },
  });
  if (!calculo) {
    throw notFound("REPORTE_FV_SIN_CALCULO", "No se encontró el cálculo del periodo recién generado");
  }

  // La cobertura del medidor no está en la configuración sino en la lectura del
  // mes: se pasa aparte para que el PDF pueda aclarar cuando la medición fue
  // parcial. Sin esto el cliente recibiría números calculados sobre medio mes
  // sin ninguna advertencia.
  const lectura = await prisma.reporteFvLectura.findFirst({
    where: { projectId: config.projectId, periodo: periodoADate(periodo) },
    select: { diasConDatos: true, diasEsperados: true, consumoFuente: true },
  });

  // Consumo medido en menos de la mitad del período: no se puede estimar el mes.
  // La ingesta ya no lo guarda, pero una lectura vieja podía conservar el
  // consumo de otro rango de días (Percovich, julio 2026: 0 de 30 días medidos
  // y el reporte salió con el consumo del mes calendario). Un consumo cargado a
  // mano no depende del medidor y pasa.
  if (
    lectura &&
    lectura.consumoFuente !== ReporteFvFuente.MANUAL &&
    lectura.diasEsperados != null &&
    lectura.diasEsperados > 0 &&
    (lectura.diasConDatos ?? 0) / lectura.diasEsperados < COBERTURA_MINIMA
  ) {
    throw badRequest(
      "REPORTE_FV_COBERTURA_INSUFICIENTE",
      `${config.clientName} — ${periodo}: el medidor registró ${lectura.diasConDatos ?? 0} de ${lectura.diasEsperados} días; no alcanza para estimar el mes`,
    );
  }

  const input = construirPdfInput(resultado, {
    ...contextoDesdeConfig(config),
    diasConDatos: lectura?.diasConDatos ?? null,
    diasEsperados: lectura?.diasEsperados ?? null,
  });
  const pdf = await generarReporteFvPdf(input);

  const version =
    ((
      await prisma.reporteFvEmision.aggregate({
        where: { projectId, periodo: periodoADate(periodo) },
        _max: { version: true },
      })
    )._max.version ?? 0) + 1;

  const stored = await saveBufferAsAttachment(
    pdf,
    buildToolGeneratedFilename({
      toolSource: TOOL_SOURCE,
      projectClientName: config.clientName,
      version,
      extension: "pdf",
    }),
    "application/pdf",
    projectId,
  );

  const emision = await prisma.$transaction(async (tx) => {
    const file = await tx.fileAttachment.create({
      data: {
        projectId,
        filename: stored.filename,
        storedFilename: stored.storedFilename,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        url: stored.url,
        tipo: FileAttachmentTipo.REPORTE_FOTOVOLTAICO,
        toolSource: TOOL_SOURCE,
        toolVersion: version,
        uploadedById: userId,
      },
    });

    const created = await tx.reporteFvEmision.create({
      data: {
        projectId,
        periodo: periodoADate(periodo),
        version,
        calculoId: calculo.id,
        estado: ReporteFvEmisionEstado.LISTO,
        snapshotJson: input as unknown as Prisma.InputJsonValue,
        fileAttachmentId: file.id,
        generadoPorId: userId,
      },
    });

    // toolEntityId apunta a la emisión (no se conocía al crear el FileAttachment).
    await tx.fileAttachment.update({ where: { id: file.id }, data: { toolEntityId: created.id } });

    return { id: created.id, fileId: file.id };
  });

  await createAuditEntry({
    entityType: AuditEntityType.reporte_fv_emision,
    entityId: emision.id,
    projectId,
    userId,
    action: AuditAction.created,
    description: `Generó el reporte fotovoltaico de ${config.clientName} — ${periodo} (v${version})`,
  });

  return { emisionId: emision.id, version, fileAttachmentId: emision.fileId, bytes: pdf.length };
}

/**
 * Regenera el PDF de una emisión existente a partir de su snapshot congelado,
 * sin recalcular. Para servir el PDF on-demand si el archivo se perdió, o para
 * previsualizar exactamente lo que se emitió.
 */
export async function regenerarPdfDesdeSnapshot(emisionId: string): Promise<Buffer> {
  const emision = await prisma.reporteFvEmision.findUnique({
    where: { id: emisionId },
    select: { snapshotJson: true },
  });
  if (!emision) throw notFound("REPORTE_FV_EMISION_NO_ENCONTRADA", "La emisión no existe");
  return generarReporteFvPdf(emision.snapshotJson as unknown as ReporteFvPdfInput);
}
