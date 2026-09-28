// Daños por granizo del plan (en el código, "siniestros": nombre interno; en
// pantalla es "daño por granizo" o "evento", nunca "siniestro").
//
// Recorrido (guía interna, "Cómo sigue un caso de granizo"):
//   REPORTADO  el cliente avisó (Anexo B + fotos). Se registra el día que avisó.
//   EVALUADO   se inspeccionó en sitio: se contaron los paneles dañados.
//   REPUESTO   se repusieron los paneles. Exige fecha, paneles repuestos y el
//              costo real, que se registra como gasto en Finanzas (categoría del
//              plan) para medir lo cobrado contra lo repuesto.
//   RECHAZADO  no se repone: exige una causal de la sección 4 de las condiciones
//              (hay que decirle al cliente por qué, citando la sección).
//
// Plazos y causales: plazos.ts. Límite anual (sección 7): cada panel se repone
// como máximo una vez por anualidad → lo repuesto en la anualidad del evento no
// puede superar los paneles cubiertos.
//
// Un daño en una fecha sin cobertura se deja cargar igual: queda marcado
// `cubiertoAlEvento = false` y decide quien lo evalúa.
//
// Fotos: FileAttachment con toolSource "seguro-granizo-siniestro" y
// toolEntityId = id del daño. Se guardan con `saveObraPhoto()` (convierte HEIC y
// genera miniatura).

import {
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  FileAttachmentTipo,
  FinanceMovementStatus,
  Moneda,
  Prisma,
  SiniestroGranizoEstado,
  TipoMovimiento,
} from "@prisma/client";
import type { MultipartFile } from "@fastify/multipart";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { deleteObraPhotoFiles, saveObraPhoto } from "../file-storage.service.js";
import { cubiertoEn } from "./estado.js";
import { fmtFecha, startOfUtcDay } from "./fechas.js";
import { MOTIVOS_RECHAZO, type MotivoRechazo } from "./plazos.js";
import { periodosParaEstado, polizaParaEstado, TOOL_SOURCE_ANEXO, TOOL_SOURCE_FOTOS_INICIO } from "./polizas.service.js";

export const TOOL_SOURCE_SINIESTRO = "seguro-granizo-siniestro";

const TRANSICIONES: Record<SiniestroGranizoEstado, SiniestroGranizoEstado[]> = {
  REPORTADO: ["EVALUADO", "RECHAZADO"],
  EVALUADO: ["REPUESTO", "RECHAZADO", "REPORTADO"],
  REPUESTO: ["EVALUADO"],
  RECHAZADO: ["REPORTADO", "EVALUADO"],
};

const ETIQUETA: Record<SiniestroGranizoEstado, string> = {
  REPORTADO: "avisado",
  EVALUADO: "inspeccionado",
  REPUESTO: "repuesto",
  RECHAZADO: "no se repone",
};

async function auditar(userId: string, id: string, projectId: string, action: AuditAction, description: string) {
  await createAuditEntry({
    entityType: AuditEntityType.seguro_granizo_siniestro,
    entityId: id,
    projectId,
    userId,
    action,
    description,
  });
}

async function cargarSiniestro(id: string) {
  const s = await prisma.seguroGranizoSiniestro.findFirst({
    where: { id, deletedAt: null },
    include: { financeMovement: { select: { id: true, deletedAt: true } } },
  });
  if (!s) throw notFound("DANIO_NOT_FOUND", "No existe ese daño por granizo");
  return s;
}

const periodosInclude = {
  periodos: {
    orderBy: { numero: "asc" },
    include: {
      financeMovement: { select: { id: true, status: true, fecha: true, monto: true, deletedAt: true, dueDate: true } },
    },
  },
} satisfies Prisma.SeguroGranizoPolizaInclude;

export async function crearSiniestro(
  polizaId: string,
  input: {
    fechaEvento: Date;
    fechaAviso?: Date | null;
    descripcion: string;
    panelesAfectados?: number | null;
    eventoMasivo?: boolean;
  },
  userId: string,
  hoyIn: Date = new Date(),
) {
  const poliza = await prisma.seguroGranizoPoliza.findFirst({
    where: { id: polizaId, deletedAt: null },
    include: { project: { select: { clientName: true } }, ...periodosInclude },
  });
  if (!poliza) throw notFound("PLAN_NOT_FOUND", "No existe el plan de granizo");

  const hoy = startOfUtcDay(hoyIn);
  const fecha = startOfUtcDay(input.fechaEvento);
  const aviso = startOfUtcDay(input.fechaAviso ?? hoy);
  if (fecha.getTime() > hoy.getTime()) throw badRequest("FECHA_FUTURA", "La fecha del granizo no puede ser futura");
  if (aviso.getTime() < fecha.getTime()) throw badRequest("AVISO_ANTES_DEL_EVENTO", "El aviso no puede ser anterior al granizo");

  const cubierto = cubiertoEn(polizaParaEstado(poliza), periodosParaEstado(poliza.periodos), fecha, hoy);

  const s = await prisma.seguroGranizoSiniestro.create({
    data: {
      polizaId,
      projectId: poliza.projectId,
      fechaEvento: fecha,
      fechaAviso: aviso,
      descripcion: input.descripcion.trim(),
      panelesAfectados: input.panelesAfectados ?? null,
      eventoMasivo: input.eventoMasivo ?? false,
      cubiertoAlEvento: cubierto,
      creadoPorId: userId,
    },
  });
  await auditar(
    userId,
    s.id,
    poliza.projectId,
    AuditAction.created,
    `Daño por granizo del ${fmtFecha(fecha)} avisado por ${poliza.project.clientName} el ${fmtFecha(aviso)}` +
      (input.panelesAfectados ? ` (${input.panelesAfectados} paneles)` : "") +
      (cubierto ? "" : " — SIN cobertura activa ese día"),
  );
  return s;
}

export type ActualizarSiniestroInput = {
  estado?: SiniestroGranizoEstado;
  descripcion?: string;
  fechaEvento?: Date;
  fechaAviso?: Date;
  panelesAfectados?: number | null;
  eventoMasivo?: boolean;
  fechaInspeccion?: Date | null;
  evaluacionNota?: string | null;
  fechaReposicion?: Date | null;
  panelesRepuestos?: number | null;
  costoRealUsd?: number | null;
  costoDetalle?: string | null;
  motivoRechazoCodigo?: MotivoRechazo | null;
  motivoRechazo?: string | null;
};

// Paneles ya repuestos en la anualidad que contiene `fecha` (sin contar `excluirId`).
async function panelesRepuestosEnAnualidad(polizaId: string, fecha: Date, excluirId: string) {
  const periodo = await prisma.seguroGranizoPeriodo.findFirst({
    where: { polizaId, desde: { lte: fecha }, hasta: { gt: fecha } },
  });
  if (!periodo) return { periodo: null, usados: 0 };
  const agg = await prisma.seguroGranizoSiniestro.aggregate({
    where: {
      polizaId,
      id: { not: excluirId },
      deletedAt: null,
      estado: SiniestroGranizoEstado.REPUESTO,
      fechaEvento: { gte: periodo.desde, lt: periodo.hasta },
    },
    _sum: { panelesRepuestos: true },
  });
  return { periodo, usados: agg._sum.panelesRepuestos ?? 0 };
}

export async function actualizarSiniestro(id: string, input: ActualizarSiniestroInput, userId: string, hoyIn: Date = new Date()) {
  const s = await cargarSiniestro(id);
  const hoy = startOfUtcDay(hoyIn);
  const data: Prisma.SeguroGranizoSiniestroUncheckedUpdateInput = {};
  const v = <K extends keyof ActualizarSiniestroInput>(k: K, actual: unknown) =>
    (input[k] !== undefined ? input[k] : actual) as never;

  if (input.descripcion !== undefined) data.descripcion = input.descripcion.trim();
  if (input.fechaEvento !== undefined) data.fechaEvento = startOfUtcDay(input.fechaEvento);
  if (input.fechaAviso !== undefined) data.fechaAviso = startOfUtcDay(input.fechaAviso);
  if (input.panelesAfectados !== undefined) data.panelesAfectados = input.panelesAfectados;
  if (input.eventoMasivo !== undefined) data.eventoMasivo = input.eventoMasivo;
  if (input.fechaInspeccion !== undefined) data.fechaInspeccion = input.fechaInspeccion ? startOfUtcDay(input.fechaInspeccion) : null;
  if (input.evaluacionNota !== undefined) data.evaluacionNota = input.evaluacionNota?.trim() || null;
  if (input.fechaReposicion !== undefined) data.fechaReposicion = input.fechaReposicion ? startOfUtcDay(input.fechaReposicion) : null;
  if (input.panelesRepuestos !== undefined) data.panelesRepuestos = input.panelesRepuestos;
  if (input.costoDetalle !== undefined) data.costoDetalle = input.costoDetalle?.trim() || null;
  if (input.costoRealUsd !== undefined) data.costoRealUsd = input.costoRealUsd == null ? null : new Prisma.Decimal(input.costoRealUsd);
  if (input.motivoRechazoCodigo !== undefined) data.motivoRechazoCodigo = input.motivoRechazoCodigo;
  if (input.motivoRechazo !== undefined) data.motivoRechazo = input.motivoRechazo?.trim() || null;

  const nuevoEstado = input.estado && input.estado !== s.estado ? input.estado : null;
  const estadoFinal = nuevoEstado ?? s.estado;
  if (nuevoEstado && !TRANSICIONES[s.estado].includes(nuevoEstado)) {
    throw badRequest("TRANSICION_INVALIDA", `No se puede pasar de ${ETIQUETA[s.estado]} a ${ETIQUETA[nuevoEstado]}`);
  }

  // Validaciones por estado (sobre los valores finales, nuevos o actuales).
  const fechaEvento = startOfUtcDay(v("fechaEvento", s.fechaEvento));
  if (nuevoEstado === "EVALUADO" && input.fechaInspeccion === undefined && !s.fechaInspeccion) data.fechaInspeccion = hoy;

  let costo: number | null = null;
  let panelesRepuestos: number | null = null;
  if (estadoFinal === "REPUESTO") {
    costo = v("costoRealUsd", s.costoRealUsd != null ? Number(s.costoRealUsd) : null);
    panelesRepuestos = v("panelesRepuestos", s.panelesRepuestos);
    if (costo == null || costo < 0) throw badRequest("COSTO_REQUERIDO", "Para marcarlo repuesto cargá el costo real de la reposición");
    if (!panelesRepuestos || panelesRepuestos <= 0) throw badRequest("PANELES_REQUERIDOS", "Cargá cuántos paneles se repusieron");
    if (!v("fechaReposicion", s.fechaReposicion)) data.fechaReposicion = hoy;
    const { periodo, usados } = await panelesRepuestosEnAnualidad(s.polizaId, fechaEvento, s.id);
    if (periodo && usados + panelesRepuestos > periodo.cantidadPaneles) {
      throw badRequest(
        "LIMITE_ANUAL",
        `En esta anualidad ya se repusieron ${usados} de ${periodo.cantidadPaneles} paneles: cada panel se repone una vez por año (sección 7)`,
      );
    }
  }
  if (estadoFinal === "RECHAZADO") {
    const codigo = v("motivoRechazoCodigo", s.motivoRechazoCodigo) as MotivoRechazo | null;
    if (!codigo || !(codigo in MOTIVOS_RECHAZO)) {
      throw badRequest("MOTIVO_REQUERIDO", "Elegí por qué no se repone (causal de las condiciones)");
    }
    const nota = v("motivoRechazo", s.motivoRechazo) as string | null;
    if (codigo === "OTRO" && !nota?.trim()) throw badRequest("MOTIVO_REQUERIDO", "Detallá el motivo");
  }
  if (nuevoEstado) {
    data.estado = nuevoEstado;
    if (nuevoEstado === "EVALUADO") data.evaluadoEn = new Date();
    if (nuevoEstado === "REPUESTO" || nuevoEstado === "RECHAZADO") data.resueltoEn = new Date();
    if (nuevoEstado === "REPORTADO") {
      data.evaluadoEn = null;
      data.resueltoEn = null;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.seguroGranizoSiniestro.update({ where: { id }, data });
    await sincronizarGasto(tx, u, userId);
    return tx.seguroGranizoSiniestro.findUniqueOrThrow({ where: { id } });
  });

  await auditar(
    userId,
    id,
    s.projectId,
    nuevoEstado ? AuditAction.status_changed : AuditAction.updated,
    nuevoEstado
      ? `Daño por granizo del ${fmtFecha(s.fechaEvento)}: ${ETIQUETA[s.estado]} → ${ETIQUETA[nuevoEstado]}` +
          (nuevoEstado === "REPUESTO" ? ` (${panelesRepuestos} paneles, costo USD ${costo})` : "") +
          (nuevoEstado === "RECHAZADO" && updated.motivoRechazoCodigo
            ? ` — ${MOTIVOS_RECHAZO[updated.motivoRechazoCodigo as MotivoRechazo]}`
            : "")
      : `Daño por granizo del ${fmtFecha(s.fechaEvento)} editado`,
  );
  return updated;
}

// El costo de la reposición vive como GASTO de la categoría del plan: se crea al
// marcar repuesto, se actualiza si cambia el costo y se anula si deja de estar
// repuesto (o se borra el daño).
async function sincronizarGasto(
  tx: Prisma.TransactionClient,
  s: { id: string; projectId: string; estado: SiniestroGranizoEstado; costoRealUsd: Prisma.Decimal | null; fechaReposicion: Date | null; fechaEvento: Date; panelesRepuestos: number | null; financeMovementId: string | null; deletedAt: Date | null },
  userId: string,
) {
  const debeTener = !s.deletedAt && s.estado === "REPUESTO" && s.costoRealUsd != null && Number(s.costoRealUsd) > 0;
  const mov = s.financeMovementId ? await tx.financeMovement.findUnique({ where: { id: s.financeMovementId } }) : null;
  const movVivo = mov && !mov.deletedAt ? mov : null;

  if (!debeTener) {
    if (movVivo) await tx.financeMovement.update({ where: { id: movVivo.id }, data: { deletedAt: new Date() } });
    return;
  }
  const fecha = startOfUtcDay(s.fechaReposicion ?? new Date());
  const datos = {
    fecha,
    mes: fecha.getUTCMonth() + 1,
    anio: fecha.getUTCFullYear(),
    monto: s.costoRealUsd!,
    descripcion: `Plan granizo · reposición de ${s.panelesRepuestos ?? "?"} paneles (granizo del ${fmtFecha(s.fechaEvento)})`,
  };
  if (movVivo) {
    await tx.financeMovement.update({ where: { id: movVivo.id }, data: datos });
    return;
  }
  const nuevo = await tx.financeMovement.create({
    data: {
      ...datos,
      tipoMovimiento: TipoMovimiento.GASTO,
      categoriaPrincipal: CategoriaPrincipal.SEGURO_GRANIZO,
      moneda: Moneda.USD,
      status: FinanceMovementStatus.PAGADO,
      pagado: true,
      impactaFlujo: true,
      projectId: s.projectId,
      creadoPorId: userId,
    },
  });
  await tx.seguroGranizoSiniestro.update({ where: { id: s.id }, data: { financeMovementId: nuevo.id } });
}

export async function borrarSiniestro(id: string, userId: string) {
  const s = await cargarSiniestro(id);
  const fotos = await prisma.fileAttachment.findMany({
    where: { toolSource: TOOL_SOURCE_SINIESTRO, toolEntityId: id, deletedAt: null },
  });
  await prisma.$transaction(async (tx) => {
    const u = await tx.seguroGranizoSiniestro.update({ where: { id }, data: { deletedAt: new Date() } });
    await sincronizarGasto(tx, u, userId);
    await tx.fileAttachment.updateMany({ where: { id: { in: fotos.map((f) => f.id) } }, data: { deletedAt: new Date() } });
  });
  for (const f of fotos) await deleteObraPhotoFiles(f.url);
  await auditar(userId, id, s.projectId, AuditAction.deleted, `Daño por granizo del ${fmtFecha(s.fechaEvento)} eliminado`);
}

// ─── Fotos ───────────────────────────────────────────────────────────────────

function mapFoto(f: { id: string; filename: string; createdAt: Date }) {
  return {
    id: f.id,
    filename: f.filename,
    thumbnailUrl: `/api/seguro-granizo/archivos/${f.id}?thumb=1`,
    fullUrl: `/api/seguro-granizo/archivos/${f.id}`,
    createdAt: f.createdAt.toISOString(),
  };
}

export async function listarFotos(siniestroIds: string[]) {
  const out = new Map<string, ReturnType<typeof mapFoto>[]>();
  if (siniestroIds.length === 0) return out;
  const rows = await prisma.fileAttachment.findMany({
    where: { toolSource: TOOL_SOURCE_SINIESTRO, toolEntityId: { in: siniestroIds }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  for (const r of rows) {
    const k = r.toolEntityId!;
    out.set(k, [...(out.get(k) ?? []), mapFoto(r)]);
  }
  return out;
}

export async function subirFoto(siniestroId: string, file: MultipartFile, userId: string) {
  const s = await cargarSiniestro(siniestroId);
  const saved = await saveObraPhoto(file, s.projectId);
  const att = await prisma.fileAttachment.create({
    data: {
      projectId: s.projectId,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      tipo: FileAttachmentTipo.OTRO,
      toolSource: TOOL_SOURCE_SINIESTRO,
      toolEntityId: siniestroId,
      uploadedById: userId,
    },
  });
  await createAuditEntry({
    entityType: AuditEntityType.file,
    entityId: att.id,
    projectId: s.projectId,
    userId,
    action: AuditAction.file_uploaded,
    description: `Subió foto del daño por granizo del ${fmtFecha(s.fechaEvento)}: '${saved.filename}'`,
  });
  return mapFoto(att);
}

export async function borrarFoto(siniestroId: string, fileId: string, userId: string) {
  const f = await prisma.fileAttachment.findFirst({
    where: { id: fileId, toolSource: TOOL_SOURCE_SINIESTRO, toolEntityId: siniestroId, deletedAt: null },
  });
  if (!f) throw notFound("PHOTO_NOT_FOUND", "Foto no encontrada");
  await prisma.fileAttachment.update({ where: { id: f.id }, data: { deletedAt: new Date() } });
  await deleteObraPhotoFiles(f.url);
  await createAuditEntry({
    entityType: AuditEntityType.file,
    entityId: f.id,
    projectId: f.projectId,
    userId,
    action: AuditAction.deleted,
    description: `Eliminó foto del daño por granizo '${f.filename}'`,
  });
}

// Fotos de daños, fotos de inicio y Anexos A firmados: los sirve el endpoint propio del plan.
export async function getArchivoPlan(fileId: string) {
  const f = await prisma.fileAttachment.findFirst({
    where: { id: fileId, toolSource: { in: [TOOL_SOURCE_SINIESTRO, TOOL_SOURCE_ANEXO, TOOL_SOURCE_FOTOS_INICIO] }, deletedAt: null },
  });
  if (!f) throw notFound("FILE_NOT_FOUND", "Archivo no encontrado");
  return f;
}
