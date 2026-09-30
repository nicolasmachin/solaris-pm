// Plan de Protección contra Granizo (servicio de reposición de Voltia).
//
// OJO con el vocabulario: NO es un seguro. En todo lo que lee una persona se
// dice "plan", "condiciones del plan", "anualidad" y "daño por granizo". Los
// nombres internos (SeguroGranizo*) quedaron del arranque y no se muestran.
//
// Un plan por proyecto (las ampliaciones se suman al plan de la obra original),
// partido en anualidades. Cada anualidad tiene su cobro en Finanzas: un
// FinanceMovement INGRESO / SEGURO_GRANIZO que arranca PREVISTO. El estado de
// pago se lee siempre de ese movimiento (si Finanzas lo marca cobrado o lo
// borra desde Movimientos, el plan lo refleja solo).
//
// Reglas (Condiciones generales, sección 5) → ver estado.ts. Acá importa:
//   - Adhesión con la obra (`sinCarencia`): la anualidad 1 arranca en la puesta
//     en marcha (habilitación) y vence ese mismo día.
//   - Cliente existente o re-adhesión: la anualidad arranca al pago + 30 días
//     de carencia. Al crearla el inicio es provisorio (`inicioAlPagar`) y se
//     fija cuando se registra el pago.
//
// SEGURO_GRANIZO queda afuera del saldo de la obra (`listarCobrosPorProyecto()`
// y `/finance/cobros-by-project/:projectId`) y va en línea propia en resultados.

import {
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  FileAttachmentTipo,
  FinanceMovementStatus,
  Moneda,
  Prisma,
  SeguroGranizoEstado,
  SeguroGranizoOrigen,
  TipoMovimiento,
} from "@prisma/client";
import type { MultipartFile } from "@fastify/multipart";

import { prisma } from "../../lib/prisma.js";
import { getAnclaMantenimiento } from "../../utils/aniversario.js";
import { toDateOnlyString } from "../../utils/dates.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { deleteObraPhotoFiles, deleteStoredFile, saveObraPhoto, saveUploadedFile } from "../file-storage.service.js";
import { calcularEstadoPoliza, DIAS_CARENCIA, type EstadoPoliza, type PeriodoParaEstado } from "./estado.js";
import { addDays, fmtFecha, startOfUtcDay, sumarUnAnio } from "./fechas.js";
import { calcularPlazosDanio, MOTIVOS_RECHAZO, type MotivoRechazo, type PlazoEtapa } from "./plazos.js";

export const PRECIO_PLAN_DEFAULT_USD = 12;
export const TOOL_SOURCE_ANEXO = "plan-granizo-anexo";
// Fotos del estado de los paneles al adherirse una instalación existente
// (condiciones, sección 3): la única prueba si después aparece un daño previo.
export const TOOL_SOURCE_FOTOS_INICIO = "plan-granizo-fotos-inicio";

type Tx = Prisma.TransactionClient;

function redondear(n: number) {
  return Math.round(n * 100) / 100;
}

// ─── Precio y cantidad de paneles ────────────────────────────────────────────

// Precio vigente por panel y por año (IVA incluido). Sale de la configuración de
// propuestas (Admin → Propuestas); si no está cargado, USD 12.
export async function precioPlanPorPanelUsd(): Promise<number> {
  const row = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" }, select: { data: true } });
  const data = (row?.data ?? {}) as Record<string, { value?: unknown } | undefined>;
  const v = Number(data.precioSeguroGranizoUsdPorPanelAno?.value);
  return Number.isFinite(v) && v > 0 ? v : PRECIO_PLAN_DEFAULT_USD;
}

export type FuentePaneles = "UNIFILAR" | "PROPUESTA" | "MANUAL";

// Con varios suministros hay un unifilar por cada uno: los paneles de la obra
// son la suma de la última versión de cada suministro.
async function panelesDeUnifilar(projectId: string): Promise<number | null> {
  const versiones = await prisma.unifilarVersion.findMany({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
    select: { suministro: true, cantidadPaneles: true },
  });
  const ultimaPorSuministro = new Map<number, number>();
  for (const v of versiones) {
    if (!ultimaPorSuministro.has(v.suministro)) ultimaPorSuministro.set(v.suministro, v.cantidadPaneles);
  }
  const total = [...ultimaPorSuministro.values()].reduce((a, n) => a + (n > 0 ? n : 0), 0);
  return total > 0 ? total : null;
}

async function panelesDePropuesta(projectId: string): Promise<number | null> {
  const lead = await prisma.salesLead.findFirst({
    where: { convertedToProjectId: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!lead) return null;
  const version = await prisma.proposalV2Version.findFirst({
    where: { leadId: lead.id, status: "PUBLISHED", discardedAt: null },
    orderBy: { versionNumber: "desc" },
    select: { snapshot: true },
  });
  const snap = version?.snapshot as { data?: { sistema?: { cantidadPaneles?: unknown } } } | null;
  const n = Number(snap?.data?.sistema?.cantidadPaneles);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Paneles de la instalación: la obra más sus ampliaciones (el plan es siempre por
// todos los paneles). De cada una, el último unifilar (lo construido) y si no hay,
// la última propuesta publicada. Si la obra principal no tiene ninguno, null.
export async function resolverCantidadPaneles(
  projectId: string,
): Promise<{ cantidad: number | null; fuente: FuentePaneles; ampliaciones: number }> {
  const ampliaciones = await prisma.project.findMany({
    where: { parentProjectId: projectId, deletedAt: null },
    select: { id: true },
  });
  let fuente: FuentePaneles = "UNIFILAR";
  let cantidad = await panelesDeUnifilar(projectId);
  if (cantidad == null) {
    cantidad = await panelesDePropuesta(projectId);
    fuente = "PROPUESTA";
  }
  if (cantidad == null) return { cantidad: null, fuente: "MANUAL", ampliaciones: ampliaciones.length };
  for (const a of ampliaciones) {
    const n = (await panelesDeUnifilar(a.id)) ?? (await panelesDePropuesta(a.id));
    if (n) cantidad += n;
  }
  return { cantidad, fuente, ampliaciones: ampliaciones.length };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

const polizaInclude = {
  project: {
    select: {
      id: true,
      code: true,
      clientName: true,
      capacityKwp: true,
      status: true,
      postHabilitacionInicioEn: true,
      actualUteEnd: true,
    },
  },
  periodos: {
    orderBy: { numero: "asc" },
    include: {
      financeMovement: {
        select: { id: true, status: true, fecha: true, monto: true, deletedAt: true, dueDate: true },
      },
    },
  },
  siniestros: {
    where: { deletedAt: null },
    orderBy: { fechaEvento: "desc" },
  },
  ampliaciones: {
    orderBy: { desde: "asc" },
    include: { financeMovement: { select: { id: true, status: true, fecha: true, deletedAt: true } } },
  },
} satisfies Prisma.SeguroGranizoPolizaInclude;

type PolizaConTodo = Prisma.SeguroGranizoPolizaGetPayload<{ include: typeof polizaInclude }>;
type PeriodoConMov = PolizaConTodo["periodos"][number];

function periodoPagado(p: { financeMovement: PeriodoConMov["financeMovement"] }) {
  const m = p.financeMovement;
  return !!m && !m.deletedAt && m.status === FinanceMovementStatus.PAGADO;
}

export function periodosParaEstado(periodos: PeriodoConMov[]): PeriodoParaEstado[] {
  return periodos.map((p) => ({
    id: p.id,
    numero: p.numero,
    desde: p.desde,
    hasta: p.hasta,
    montoUsd: Number(p.montoUsd),
    pagado: periodoPagado(p),
    fechaPago: periodoPagado(p) ? p.financeMovement!.fecha : null,
    inicioAlPagar: p.inicioAlPagar,
  }));
}

export function polizaParaEstado(p: {
  estado: SeguroGranizoEstado;
  montoAnualUsd: Prisma.Decimal;
  sinCarencia: boolean;
  anexoFirmadoEn: Date | null;
}) {
  return {
    estado: p.estado,
    montoAnualUsd: Number(p.montoAnualUsd),
    sinCarencia: p.sinCarencia,
    anexoFirmadoEn: p.anexoFirmadoEn,
  };
}

export function estadoDePoliza(poliza: PolizaConTodo, hoy: Date = new Date()): EstadoPoliza {
  return calcularEstadoPoliza(polizaParaEstado(poliza), periodosParaEstado(poliza.periodos), hoy);
}

function serializeEstado(e: EstadoPoliza) {
  return {
    ...e,
    coberturaDesde: toDateOnlyString(e.coberturaDesde),
    vencimiento: toDateOnlyString(e.vencimiento),
    proximoCobro: e.proximoCobro ? { ...e.proximoCobro, fecha: toDateOnlyString(e.proximoCobro.fecha) } : null,
  };
}

function serializePeriodo(p: PeriodoConMov) {
  const m = p.financeMovement;
  const cobroEstado = !m || m.deletedAt ? "SIN_COBRO" : m.status === FinanceMovementStatus.PAGADO ? "PAGADO" : "PREVISTO";
  return {
    id: p.id,
    numero: p.numero,
    desde: toDateOnlyString(p.desde),
    hasta: toDateOnlyString(p.hasta),
    // Inicio provisorio: se fija al registrar el pago (pago + carencia).
    inicioProvisorio: p.inicioAlPagar && cobroEstado !== "PAGADO",
    cantidadPaneles: p.cantidadPaneles,
    precioPorPanelUsd: Number(p.precioPorPanelUsd),
    montoUsd: Number(p.montoUsd),
    cobro: {
      estado: cobroEstado as "SIN_COBRO" | "PAGADO" | "PREVISTO",
      movementId: m && !m.deletedAt ? m.id : null,
      fechaPago: cobroEstado === "PAGADO" && m ? toDateOnlyString(m.fecha) : null,
      vence: toDateOnlyString(m?.dueDate ?? p.desde),
    },
  };
}

function serializePlazo(p: PlazoEtapa | null) {
  return p ? { ...p, limite: toDateOnlyString(p.limite) } : null;
}

function serializeSiniestro(s: PolizaConTodo["siniestros"][number], hoy: Date) {
  const plazos = calcularPlazosDanio(s, hoy);
  return {
    id: s.id,
    fechaEvento: toDateOnlyString(s.fechaEvento),
    fechaAviso: toDateOnlyString(s.fechaAviso),
    descripcion: s.descripcion,
    panelesAfectados: s.panelesAfectados,
    eventoMasivo: s.eventoMasivo,
    estado: s.estado,
    cubiertoAlEvento: s.cubiertoAlEvento,
    fechaInspeccion: toDateOnlyString(s.fechaInspeccion),
    fechaReposicion: toDateOnlyString(s.fechaReposicion),
    panelesRepuestos: s.panelesRepuestos,
    evaluacionNota: s.evaluacionNota,
    motivoRechazoCodigo: s.motivoRechazoCodigo,
    motivoRechazoLabel: s.motivoRechazoCodigo ? (MOTIVOS_RECHAZO[s.motivoRechazoCodigo as MotivoRechazo] ?? null) : null,
    motivoRechazo: s.motivoRechazo,
    plazos: {
      ...plazos,
      inspeccion: serializePlazo(plazos.inspeccion),
      reposicion: serializePlazo(plazos.reposicion),
    },
    costoRealUsd: s.costoRealUsd != null ? Number(s.costoRealUsd) : null,
    costoDetalle: s.costoDetalle,
    createdAt: s.createdAt.toISOString(),
  };
}

export function serializePoliza(p: PolizaConTodo, hoy: Date = new Date()) {
  return {
    id: p.id,
    projectId: p.projectId,
    project: {
      id: p.project.id,
      code: p.project.code,
      clientName: p.project.clientName,
      capacityKwp: p.project.capacityKwp != null ? Number(p.project.capacityKwp) : null,
    },
    leadId: p.leadId,
    origen: p.origen,
    estadoBase: p.estado,
    sinCarencia: p.sinCarencia,
    inversorSerie: p.inversorSerie,
    ampliaciones: p.ampliaciones.map((a) => {
      const m = a.financeMovement;
      const pagado = !!m && !m.deletedAt && m.status === FinanceMovementStatus.PAGADO;
      return {
        id: a.id,
        projectId: a.projectId,
        paneles: a.paneles,
        desde: toDateOnlyString(a.desde),
        hasta: toDateOnlyString(a.hasta),
        meses: a.meses,
        montoUsd: Number(a.montoUsd),
        cobro: {
          estado: (!m || m.deletedAt ? "SIN_COBRO" : pagado ? "PAGADO" : "PREVISTO") as "SIN_COBRO" | "PAGADO" | "PREVISTO",
          fechaPago: pagado ? toDateOnlyString(m!.fecha) : null,
        },
      };
    }),
    anexo: {
      firmadoEn: toDateOnlyString(p.anexoFirmadoEn),
      fileId: p.anexoFileId,
      url: p.anexoFileId ? `/api/seguro-granizo/archivos/${p.anexoFileId}` : null,
    },
    fechaInicio: toDateOnlyString(p.fechaInicio),
    fechaVencimiento: toDateOnlyString(p.fechaVencimiento),
    cantidadPaneles: p.cantidadPaneles,
    cantidadPanelesFuente: p.cantidadPanelesFuente,
    precioPorPanelUsd: Number(p.precioPorPanelUsd),
    montoAnualUsd: Number(p.montoAnualUsd),
    notas: p.notas,
    canceladaEn: p.canceladaEn?.toISOString() ?? null,
    motivoCancelacion: p.motivoCancelacion,
    createdAt: p.createdAt.toISOString(),
    estado: serializeEstado(estadoDePoliza(p, hoy)),
    periodos: p.periodos.map(serializePeriodo),
    siniestros: p.siniestros.map((s) => serializeSiniestro(s, hoy)),
  };
}

export type PolizaDTO = ReturnType<typeof serializePoliza>;

async function cargarPoliza(id: string, db: Tx | typeof prisma = prisma): Promise<PolizaConTodo> {
  const p = await db.seguroGranizoPoliza.findFirst({ where: { id, deletedAt: null }, include: polizaInclude });
  if (!p) throw notFound("PLAN_NOT_FOUND", "No existe el plan de granizo");
  return p;
}

// Todos los planes vigentes en la base (sin baja lógica), con todo lo que hace
// falta para calcular su estado. Lo usan el job diario y el resumen de la mañana.
export function listarPolizasCompletas() {
  return prisma.seguroGranizoPoliza.findMany({ where: { deletedAt: null }, include: polizaInclude });
}

export async function getPoliza(id: string) {
  return serializePoliza(await cargarPoliza(id));
}

// Plan del proyecto (o del proyecto original, si es una ampliación) + sugerencias
// para darlo de alta.
export async function getPolizaDeProyecto(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      postHabilitacionInicioEn: true,
      actualUteEnd: true,
      parentProjectId: true,
      parentProject: { select: { id: true, clientName: true, code: true } },
    },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const titularId = project.parentProjectId ?? project.id;
  const poliza = await prisma.seguroGranizoPoliza.findFirst({
    where: { projectId: titularId, deletedAt: null },
    include: polizaInclude,
  });
  const [paneles, precio] = await Promise.all([resolverCantidadPaneles(titularId), precioPlanPorPanelUsd()]);
  return {
    poliza: poliza ? serializePoliza(poliza) : null,
    // Si es una ampliación, el plan es el de la obra original.
    esAmpliacionDe: project.parentProject
      ? { projectId: project.parentProject.id, clientName: project.parentProject.clientName, code: project.parentProject.code }
      : null,
    sugerencias: {
      cantidadPaneles: paneles.cantidad,
      fuente: paneles.fuente,
      ampliaciones: paneles.ampliaciones,
      precioPorPanelUsd: precio,
      puestaEnMarcha: toDateOnlyString(getAnclaMantenimiento(project)),
    },
  };
}

export type FiltroEstado =
  | "PENDIENTE_INICIO"
  | "PENDIENTE_ACTIVACION"
  | "EN_CARENCIA"
  | "VIGENTE"
  | "POR_VENCER"
  | "EN_GRACIA"
  | "SUSPENDIDA"
  | "VENCIDA"
  | "CANCELADA"
  | "ALERTA";

export async function listarPolizas(filtro: { estado?: FiltroEstado; q?: string } = {}, hoyIn: Date = new Date()) {
  const hoy = startOfUtcDay(hoyIn);
  const q = filtro.q?.trim();
  const rows = await prisma.seguroGranizoPoliza.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            project: {
              OR: [
                { clientName: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: polizaInclude,
  });

  // Fotos de inicio en una sola consulta (el listado marca si faltan).
  const fotos = await prisma.fileAttachment.findMany({
    where: { toolSource: TOOL_SOURCE_FOTOS_INICIO, toolEntityId: { in: rows.map((r) => r.id) }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const fotosPor = new Map<string, ReturnType<typeof mapArchivo>[]>();
  for (const f of fotos) fotosPor.set(f.toolEntityId!, [...(fotosPor.get(f.toolEntityId!) ?? []), mapArchivo(f)]);
  const todas = rows.map((r) => ({
    ...serializePoliza(r, hoy),
    fotosInicio: fotosPor.get(r.id) ?? [],
  }));

  // KPIs sobre todos (no dependen del filtro).
  const anio = hoy.getUTCFullYear();
  const [cobrado, reposiciones] = await Promise.all(
    [TipoMovimiento.INGRESO, TipoMovimiento.GASTO].map((tipoMovimiento) =>
      prisma.financeMovement.aggregate({
        where: {
          categoriaPrincipal: CategoriaPrincipal.SEGURO_GRANIZO,
          tipoMovimiento,
          status: FinanceMovementStatus.PAGADO,
          deletedAt: null,
          anio,
        },
        _sum: { monto: true },
      }),
    ),
  );
  const activas = todas.filter((p) => p.estado.coberturaActiva);
  const kpis = {
    vigentes: activas.length,
    panelesCubiertos: activas.reduce((acc, p) => acc + p.cantidadPaneles, 0),
    cobradoAnioUsd: Number(cobrado!._sum.monto ?? 0),
    reposicionesAnioUsd: Number(reposiciones!._sum.monto ?? 0),
    pendienteCobroUsd: redondear(
      todas
        .filter((p) => p.estadoBase !== SeguroGranizoEstado.CANCELADA)
        .reduce(
          (acc, p) => acc + p.periodos.filter((x) => x.cobro.estado === "PREVISTO").reduce((a, x) => a + x.montoUsd, 0),
          0,
        ),
    ),
    enAlerta: todas.filter((p) => p.estado.alerta).length,
    anio,
  };

  const items = todas
    .filter((p) => {
      if (!filtro.estado) return true;
      if (filtro.estado === "ALERTA") return p.estado.alerta;
      return p.estado.estado === filtro.estado;
    })
    // Primero lo que requiere acción, después por vencimiento más cercano.
    .sort((a, b) => {
      if (a.estado.alerta !== b.estado.alerta) return a.estado.alerta ? -1 : 1;
      return (a.estado.vencimiento ?? "9999").localeCompare(b.estado.vencimiento ?? "9999");
    });

  return { items, kpis };
}

// Resumen liviano por proyecto para la lista de Generadores y la ficha. Las
// ampliaciones heredan el plan de su obra original.
export type ResumenPlan = {
  polizaId: string;
  estado: EstadoPoliza["estado"];
  alerta: boolean;
  coberturaActiva: boolean;
  vencimiento: string | null;
  diasParaVencer: number | null;
};

export async function resumenPlanPorProyecto(projectIds: string[], hoy: Date = new Date()) {
  const out = new Map<string, ResumenPlan>();
  if (projectIds.length === 0) return out;
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, parentProjectId: true },
  });
  const titularDe = new Map(projects.map((p) => [p.id, p.parentProjectId ?? p.id]));
  const rows = await prisma.seguroGranizoPoliza.findMany({
    where: { projectId: { in: [...new Set(titularDe.values())] }, deletedAt: null },
    include: polizaInclude,
  });
  const porTitular = new Map<string, ResumenPlan>();
  for (const r of rows) {
    const e = estadoDePoliza(r, hoy);
    porTitular.set(r.projectId, {
      polizaId: r.id,
      estado: e.estado,
      alerta: e.alerta,
      coberturaActiva: e.coberturaActiva,
      vencimiento: toDateOnlyString(e.vencimiento),
      diasParaVencer: e.diasParaVencer,
    });
  }
  for (const [id, titular] of titularDe) {
    const r = porTitular.get(titular);
    if (r) out.set(id, r);
  }
  return out;
}

// ─── Cobros ──────────────────────────────────────────────────────────────────

function descripcionCobro(numero: number, desde: Date, hasta: Date, paneles: number, provisorio = false) {
  const vigencia = provisorio ? "inicio al pago + 30 días" : `${fmtFecha(desde)}–${fmtFecha(hasta)}`;
  return `Plan granizo · anualidad ${numero} (${vigencia}) · ${paneles} paneles`;
}

async function crearCobroPeriodo(
  tx: Tx,
  periodo: {
    id: string;
    numero: number;
    desde: Date;
    hasta: Date;
    cantidadPaneles: number;
    montoUsd: Prisma.Decimal | number;
    inicioAlPagar: boolean;
  },
  projectId: string,
  vence: Date,
  userId: string | null,
) {
  const mov = await tx.financeMovement.create({
    data: {
      fecha: vence,
      mes: vence.getUTCMonth() + 1,
      anio: vence.getUTCFullYear(),
      tipoMovimiento: TipoMovimiento.INGRESO,
      categoriaPrincipal: CategoriaPrincipal.SEGURO_GRANIZO,
      descripcion: descripcionCobro(periodo.numero, periodo.desde, periodo.hasta, periodo.cantidadPaneles, periodo.inicioAlPagar),
      monto: new Prisma.Decimal(periodo.montoUsd),
      moneda: Moneda.USD,
      status: FinanceMovementStatus.PREVISTO,
      cobrado: false,
      impactaFlujo: true,
      dueDate: vence,
      projectId,
      creadoPorId: userId,
    },
  });
  await tx.seguroGranizoPeriodo.update({ where: { id: periodo.id }, data: { financeMovementId: mov.id } });
  return mov;
}

// Crea una anualidad con su cobro previsto.
//   - Normal: cubre [desde, desde + 1 año) y el cobro vence en `desde`.
//   - inicioAlPagar: el inicio es provisorio (hoy + carencia) hasta que se
//     registre el pago; el cobro vence hoy.
async function crearPeriodo(
  tx: Tx,
  poliza: { id: string; projectId: string; cantidadPaneles: number; precioPorPanelUsd: Prisma.Decimal | number },
  numero: number,
  opts: { desde: Date; inicioAlPagar?: false } | { inicioAlPagar: true; hoy: Date },
  userId: string | null,
) {
  const desde = opts.inicioAlPagar ? addDays(startOfUtcDay(opts.hoy), DIAS_CARENCIA) : startOfUtcDay(opts.desde);
  const vence = opts.inicioAlPagar ? startOfUtcDay(opts.hoy) : desde;
  const hasta = sumarUnAnio(desde);
  const precio = Number(poliza.precioPorPanelUsd);
  const periodo = await tx.seguroGranizoPeriodo.create({
    data: {
      polizaId: poliza.id,
      numero,
      desde,
      hasta,
      inicioAlPagar: !!opts.inicioAlPagar,
      cantidadPaneles: poliza.cantidadPaneles,
      precioPorPanelUsd: new Prisma.Decimal(precio),
      montoUsd: new Prisma.Decimal(redondear(precio * poliza.cantidadPaneles)),
      creadoPorId: userId,
    },
  });
  await crearCobroPeriodo(tx, periodo, poliza.projectId, vence, userId);
  await tx.seguroGranizoPoliza.update({
    where: { id: poliza.id },
    data: { fechaVencimiento: hasta, ...(numero === 1 ? { fechaInicio: desde } : {}) },
  });
  return periodo;
}

// Registra el pago de una anualidad dentro de una transacción. Si su inicio era
// provisorio, lo fija a pago + carencia.
async function aplicarPago(tx: Tx, periodoId: string, fechaPagoIn: Date) {
  const per = await tx.seguroGranizoPeriodo.findUniqueOrThrow({ where: { id: periodoId } });
  if (!per.financeMovementId) throw badRequest("SIN_COBRO", "Esta anualidad no tiene cobro en Finanzas: regeneralo primero");
  const fecha = startOfUtcDay(fechaPagoIn);
  await tx.financeMovement.update({
    where: { id: per.financeMovementId },
    data: {
      status: FinanceMovementStatus.PAGADO,
      cobrado: true,
      fecha,
      mes: fecha.getUTCMonth() + 1,
      anio: fecha.getUTCFullYear(),
    },
  });
  if (per.inicioAlPagar) {
    const desde = addDays(fecha, DIAS_CARENCIA);
    const hasta = sumarUnAnio(desde);
    await tx.seguroGranizoPeriodo.update({ where: { id: per.id }, data: { desde, hasta } });
    await tx.financeMovement.update({
      where: { id: per.financeMovementId },
      data: { descripcion: descripcionCobro(per.numero, desde, hasta, per.cantidadPaneles) },
    });
    const ultimo = await tx.seguroGranizoPeriodo.findFirst({
      where: { polizaId: per.polizaId },
      orderBy: { numero: "desc" },
      select: { id: true },
    });
    await tx.seguroGranizoPoliza.update({
      where: { id: per.polizaId },
      data: {
        ...(per.numero === 1 ? { fechaInicio: desde } : {}),
        ...(ultimo?.id === per.id ? { fechaVencimiento: hasta } : {}),
      },
    });
  }
}

async function auditar(
  userId: string | null,
  entityId: string,
  projectId: string,
  action: AuditAction,
  description: string,
  metadata?: Prisma.InputJsonValue,
) {
  if (!userId) return; // acciones del job diario: quedan en la anualidad/cobro, sin autor.
  await createAuditEntry({
    entityType: AuditEntityType.seguro_granizo_poliza,
    entityId,
    projectId,
    userId,
    action,
    description,
    metadata,
  });
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export type CrearPolizaInput = {
  projectId: string;
  cantidadPaneles?: number | null;
  precioPorPanelUsd?: number | null;
  // Adhesión al contratar la obra: sin carencia, arranca con la puesta en marcha.
  // Default: true si viene de la venta.
  sinCarencia?: boolean;
  // Sólo con sinCarencia: inicio explícito. Si falta, la puesta en marcha; si
  // tampoco hay, queda pendiente de inicio.
  fechaInicio?: Date | null;
  origen?: SeguroGranizoOrigen;
  leadId?: string | null;
  notas?: string | null;
  inversorSerie?: string | null;
  // Para cargar clientes que ya pagaron la primera anualidad.
  primerCobroPagadoEl?: Date | null;
  userId: string | null;
};

export async function crearPoliza(input: CrearPolizaInput, hoyIn: Date = new Date()) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      clientName: true,
      postHabilitacionInicioEn: true,
      actualUteEnd: true,
      parentProject: { select: { id: true, clientName: true, seguroGranizoPoliza: { select: { id: true } } } },
    },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  if (project.parentProject?.seguroGranizoPoliza) {
    throw conflict(
      "AMPLIACION_SUMA_AL_PLAN",
      `Esta obra es una ampliación de ${project.parentProject.clientName}: sus paneles se suman a ese plan desde la próxima anualidad`,
    );
  }

  const existente = await prisma.seguroGranizoPoliza.findUnique({ where: { projectId: input.projectId } });
  if (existente) throw conflict("PLAN_EXISTE", "Este cliente ya tiene el plan de granizo");

  let cantidad = input.cantidadPaneles ?? null;
  let fuente: FuentePaneles = "MANUAL";
  if (cantidad == null) {
    const r = await resolverCantidadPaneles(input.projectId);
    cantidad = r.cantidad;
    fuente = r.fuente;
  }
  if (cantidad == null || cantidad <= 0) {
    throw badRequest("PANELES_REQUERIDOS", "No se pudo saber cuántos paneles tiene: cargalos a mano");
  }
  const precio = input.precioPorPanelUsd ?? (await precioPlanPorPanelUsd());
  const origen = input.origen ?? SeguroGranizoOrigen.MANUAL;
  const sinCarencia = input.sinCarencia ?? origen === SeguroGranizoOrigen.VENTA;
  const fechaInicio = sinCarencia
    ? input.fechaInicio === undefined
      ? getAnclaMantenimiento(project)
      : input.fechaInicio
    : null;
  const hoy = startOfUtcDay(hoyIn);

  const poliza = await prisma.$transaction(async (tx) => {
    const p = await tx.seguroGranizoPoliza.create({
      data: {
        projectId: input.projectId,
        leadId: input.leadId ?? null,
        origen,
        sinCarencia,
        // Con la obra y sin puesta en marcha todavía: espera.
        estado: sinCarencia && !fechaInicio ? SeguroGranizoEstado.PENDIENTE_INICIO : SeguroGranizoEstado.ACTIVA,
        cantidadPaneles: cantidad!,
        cantidadPanelesFuente: fuente,
        precioPorPanelUsd: new Prisma.Decimal(precio),
        montoAnualUsd: new Prisma.Decimal(redondear(precio * cantidad!)),
        notas: input.notas?.trim() || null,
        inversorSerie: input.inversorSerie?.trim() || null,
        creadoPorId: input.userId,
      },
    });
    let periodo: { id: string } | null = null;
    if (sinCarencia && fechaInicio) periodo = await crearPeriodo(tx, p, 1, { desde: fechaInicio }, input.userId);
    if (!sinCarencia) periodo = await crearPeriodo(tx, p, 1, { inicioAlPagar: true, hoy }, input.userId);
    if (periodo && input.primerCobroPagadoEl) await aplicarPago(tx, periodo.id, input.primerCobroPagadoEl);
    return p;
  });

  await auditar(
    input.userId,
    poliza.id,
    input.projectId,
    AuditAction.created,
    `Plan de granizo para ${project.clientName}: ${cantidad} paneles × USD ${precio} = USD ${redondear(precio * cantidad)}/año` +
      (sinCarencia
        ? fechaInicio
          ? ` (adhesión con la obra, desde ${fmtFecha(fechaInicio)})`
          : " (adhesión con la obra, arranca con la puesta en marcha)"
        : " (cliente existente: cubre desde el pago + 30 días)"),
    { origen, fuentePaneles: fuente, sinCarencia },
  );
  return getPoliza(poliza.id);
}

// Arranque de un plan contratado con la obra, en la puesta en marcha.
export async function activarPoliza(id: string, fechaInicio: Date, userId: string | null) {
  const p = await cargarPoliza(id);
  if (p.estado !== SeguroGranizoEstado.PENDIENTE_INICIO || p.periodos.length > 0) {
    throw badRequest("PLAN_YA_ACTIVO", "El plan ya está en curso");
  }
  await prisma.$transaction(async (tx) => {
    await tx.seguroGranizoPoliza.update({ where: { id }, data: { estado: SeguroGranizoEstado.ACTIVA } });
    await crearPeriodo(tx, p, 1, { desde: fechaInicio }, userId);
  });
  await auditar(userId, id, p.projectId, AuditAction.status_changed, `Plan de granizo en marcha desde ${fmtFecha(fechaInicio)}`);
  return getPoliza(id);
}

// Genera la anualidad siguiente con su cobro, al precio vigente en Admin
// (Nicolás, sep-2026) y recontando los paneles (obra + ampliaciones) salvo que
// la cantidad sea manual. Siempre sigue desde el vencimiento de la anterior,
// aunque ya haya pasado: si la paga dentro de los 15 días no pierde nada; si la
// paga después, estado.ts le aplica la nueva carencia desde el pago
// (condiciones, sección 5 "Atraso"). La re-adhesión con inicio al pago es sólo
// para un plan dado de baja que se reactiva (reactivarPoliza).
export async function renovarPoliza(id: string, userId: string | null) {
  const p = await cargarPoliza(id);
  if (p.estado !== SeguroGranizoEstado.ACTIVA) throw badRequest("PLAN_NO_ACTIVO", "Sólo se renueva un plan activo");
  const ultimo = p.periodos[p.periodos.length - 1];
  if (!ultimo) throw badRequest("PLAN_SIN_ANUALIDADES", "El plan todavía no arrancó");
  const precio = await precioPlanPorPanelUsd();
  let cantidad = p.cantidadPaneles;
  if (p.cantidadPanelesFuente !== "MANUAL") {
    const r = await resolverCantidadPaneles(p.projectId);
    if (r.cantidad) cantidad = r.cantidad;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const actualizada = await tx.seguroGranizoPoliza.update({
        where: { id },
        data: {
          cantidadPaneles: cantidad,
          precioPorPanelUsd: new Prisma.Decimal(precio),
          montoAnualUsd: new Prisma.Decimal(redondear(precio * cantidad)),
        },
      });
      await crearPeriodo(tx, actualizada, ultimo.numero + 1, { desde: ultimo.hasta }, userId);
    });
  } catch (err) {
    // Otra renovación ganó la carrera (@@unique polizaId+numero): idempotente.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return getPoliza(id);
    throw err;
  }
  await auditar(
    userId,
    id,
    p.projectId,
    AuditAction.updated,
    `Plan de granizo renovado: anualidad ${ultimo.numero + 1} desde ${fmtFecha(ultimo.hasta)} — ${cantidad} paneles, USD ${redondear(precio * cantidad)}`,
  );
  return getPoliza(id);
}

export type EditarPolizaInput = {
  cantidadPaneles?: number;
  precioPorPanelUsd?: number;
  notas?: string | null;
  sinCarencia?: boolean;
  inversorSerie?: string | null;
  // También recalcula las anualidades ya generadas que todavía no se cobraron.
  aplicarAPendientes?: boolean;
};

export async function editarPoliza(id: string, input: EditarPolizaInput, userId: string) {
  const p = await cargarPoliza(id);
  const cantidad = input.cantidadPaneles ?? p.cantidadPaneles;
  const precio = input.precioPorPanelUsd ?? Number(p.precioPorPanelUsd);
  const monto = redondear(cantidad * precio);

  await prisma.$transaction(async (tx) => {
    await tx.seguroGranizoPoliza.update({
      where: { id },
      data: {
        cantidadPaneles: cantidad,
        ...(input.cantidadPaneles !== undefined ? { cantidadPanelesFuente: "MANUAL" } : {}),
        precioPorPanelUsd: new Prisma.Decimal(precio),
        montoAnualUsd: new Prisma.Decimal(monto),
        ...(input.notas !== undefined ? { notas: input.notas?.trim() || null } : {}),
        ...(input.sinCarencia !== undefined ? { sinCarencia: input.sinCarencia } : {}),
        ...(input.inversorSerie !== undefined ? { inversorSerie: input.inversorSerie?.trim() || null } : {}),
      },
    });
    if (input.aplicarAPendientes) {
      for (const per of p.periodos) {
        if (periodoPagado(per)) continue;
        await tx.seguroGranizoPeriodo.update({
          where: { id: per.id },
          data: { cantidadPaneles: cantidad, precioPorPanelUsd: new Prisma.Decimal(precio), montoUsd: new Prisma.Decimal(monto) },
        });
        if (per.financeMovement && !per.financeMovement.deletedAt) {
          await tx.financeMovement.update({
            where: { id: per.financeMovement.id },
            data: {
              monto: new Prisma.Decimal(monto),
              descripcion: descripcionCobro(per.numero, per.desde, per.hasta, cantidad, per.inicioAlPagar),
            },
          });
        }
      }
    }
  });

  await auditar(
    userId,
    id,
    p.projectId,
    AuditAction.updated,
    `Plan de granizo editado: ${cantidad} paneles × USD ${precio} = USD ${monto}/año` +
      (input.aplicarAPendientes ? " (aplicado a los cobros pendientes)" : " (rige desde la próxima anualidad)"),
    {
      antes: { cantidadPaneles: p.cantidadPaneles, precio: Number(p.precioPorPanelUsd), sinCarencia: p.sinCarencia },
      notas: input.notas ?? null,
      ...(input.inversorSerie !== undefined && input.inversorSerie !== p.inversorSerie
        ? { inversorSerie: { antes: p.inversorSerie, despues: input.inversorSerie } }
        : {}),
    },
  );
  return getPoliza(id);
}

// Baja: la anualidad en curso no se reintegra y el plan cubre hasta el fin del
// período pago (estado.ts). Se borran las anualidades que todavía no arrancaron
// y, si se pide, se anulan los cobros pendientes (soft-delete del movimiento).
export async function cancelarPoliza(
  id: string,
  input: { motivo: string; anularCobrosPendientes: boolean },
  userId: string,
  hoyIn: Date = new Date(),
) {
  const p = await cargarPoliza(id);
  if (p.estado === SeguroGranizoEstado.CANCELADA) throw badRequest("PLAN_DADO_DE_BAJA", "El plan ya está dado de baja");
  const hoy = startOfUtcDay(hoyIn);

  await prisma.$transaction(async (tx) => {
    for (const per of p.periodos) {
      if (periodoPagado(per)) continue;
      const futuro = per.desde.getTime() > hoy.getTime();
      const mov = per.financeMovement;
      if ((futuro || input.anularCobrosPendientes) && mov && !mov.deletedAt) {
        await tx.financeMovement.update({ where: { id: mov.id }, data: { deletedAt: new Date() } });
      }
      if (futuro) await tx.seguroGranizoPeriodo.delete({ where: { id: per.id } });
    }
    const quedan = await tx.seguroGranizoPeriodo.findFirst({
      where: { polizaId: id },
      orderBy: { numero: "desc" },
      select: { hasta: true },
    });
    await tx.seguroGranizoPoliza.update({
      where: { id },
      data: {
        estado: SeguroGranizoEstado.CANCELADA,
        canceladaEn: new Date(),
        canceladaPorId: userId,
        motivoCancelacion: input.motivo.trim(),
        fechaVencimiento: quedan?.hasta ?? null,
      },
    });
  });

  await auditar(userId, id, p.projectId, AuditAction.status_changed, `Plan de granizo dado de baja: ${input.motivo.trim()}`, {
    anularCobrosPendientes: input.anularCobrosPendientes,
  });
  return getPoliza(id);
}

// Reactivar un plan dado de baja. Si todavía le queda anualidad paga, sigue
// igual. Si ya se le terminó, es una re-adhesión: se genera una anualidad con
// inicio al pago + 30 días de carencia (como un cliente existente).
export async function reactivarPoliza(id: string, userId: string, hoyIn: Date = new Date()) {
  const p = await cargarPoliza(id);
  if (p.estado !== SeguroGranizoEstado.CANCELADA) throw badRequest("PLAN_NO_DADO_DE_BAJA", "El plan no está dado de baja");
  const hoy = startOfUtcDay(hoyIn);
  const ultimo = p.periodos[p.periodos.length - 1];
  const readhesion = !!ultimo && ultimo.hasta.getTime() <= hoy.getTime();
  const precio = await precioPlanPorPanelUsd();

  await prisma.$transaction(async (tx) => {
    const actualizada = await tx.seguroGranizoPoliza.update({
      where: { id },
      data: {
        estado: p.periodos.length > 0 ? SeguroGranizoEstado.ACTIVA : SeguroGranizoEstado.PENDIENTE_INICIO,
        canceladaEn: null,
        canceladaPorId: null,
        motivoCancelacion: null,
        ...(readhesion
          ? {
              precioPorPanelUsd: new Prisma.Decimal(precio),
              montoAnualUsd: new Prisma.Decimal(redondear(precio * p.cantidadPaneles)),
            }
          : {}),
      },
    });
    if (readhesion) await crearPeriodo(tx, actualizada, ultimo!.numero + 1, { inicioAlPagar: true, hoy }, userId);
  });
  await auditar(
    userId,
    id,
    p.projectId,
    AuditAction.status_changed,
    readhesion ? "Plan de granizo reactivado como re-adhesión (cubre desde el pago + 30 días)" : "Plan de granizo reactivado",
  );
  return getPoliza(id);
}

async function cargarPeriodo(periodoId: string) {
  const per = await prisma.seguroGranizoPeriodo.findUnique({
    where: { id: periodoId },
    include: { financeMovement: true, poliza: { select: { id: true, projectId: true, deletedAt: true } } },
  });
  if (!per || per.poliza.deletedAt) throw notFound("ANUALIDAD_NOT_FOUND", "No existe esa anualidad del plan");
  return per;
}

// Marcar cobrado / volver a previsto. Cobrado pone la fecha real del pago: el
// Estado de resultados es de caja y lo imputa a ese mes; además define la
// carencia (estado.ts).
export async function marcarCobro(
  periodoId: string,
  input: { estado: "PAGADO" | "PREVISTO"; fechaPago?: Date | null },
  userId: string,
) {
  const per = await cargarPeriodo(periodoId);
  const mov = per.financeMovement;
  if (!mov || mov.deletedAt) {
    throw badRequest("SIN_COBRO", "Esta anualidad no tiene cobro en Finanzas: regeneralo primero");
  }
  const fechaPago = startOfUtcDay(input.fechaPago ?? new Date());
  await prisma.$transaction(async (tx) => {
    if (input.estado === "PAGADO") {
      await aplicarPago(tx, per.id, fechaPago);
    } else {
      const vence = mov.dueDate ?? per.desde;
      await tx.financeMovement.update({
        where: { id: mov.id },
        data: {
          status: FinanceMovementStatus.PREVISTO,
          cobrado: false,
          fecha: vence,
          mes: vence.getUTCMonth() + 1,
          anio: vence.getUTCFullYear(),
        },
      });
    }
  });
  await auditar(
    userId,
    per.poliza.id,
    per.poliza.projectId,
    AuditAction.updated,
    input.estado === "PAGADO"
      ? `Anualidad ${per.numero} del plan de granizo cobrada el ${fmtFecha(fechaPago)} — USD ${Number(per.montoUsd)}`
      : `Anualidad ${per.numero} del plan de granizo vuelta a previsto`,
    { movementId: mov.id },
  );
  await createAuditEntry({
    entityType: AuditEntityType.finance_movement,
    entityId: mov.id,
    projectId: per.poliza.projectId,
    userId,
    action: AuditAction.status_changed,
    fieldChanged: "status",
    oldValue: mov.status,
    newValue: input.estado,
    description: `Plan granizo, anualidad ${per.numero}: ${input.estado === "PAGADO" ? "cobrada" : "prevista"}`,
  });
  return getPoliza(per.poliza.id);
}

// Si Finanzas borró el movimiento, lo vuelve a crear (PREVISTO).
export async function regenerarCobro(periodoId: string, userId: string) {
  const per = await cargarPeriodo(periodoId);
  if (per.financeMovement && !per.financeMovement.deletedAt) {
    throw badRequest("COBRO_EXISTE", "Esta anualidad ya tiene su cobro en Finanzas");
  }
  await prisma.$transaction(async (tx) => {
    if (per.financeMovementId) {
      await tx.seguroGranizoPeriodo.update({ where: { id: per.id }, data: { financeMovementId: null } });
    }
    const vence = per.inicioAlPagar ? startOfUtcDay(new Date()) : per.desde;
    await crearCobroPeriodo(tx, per, per.poliza.projectId, vence, userId);
  });
  await auditar(userId, per.poliza.id, per.poliza.projectId, AuditAction.updated, `Cobro de la anualidad ${per.numero} del plan de granizo regenerado`);
  return getPoliza(per.poliza.id);
}

// ─── Anexo A firmado ─────────────────────────────────────────────────────────
// Sin el Anexo A firmado no hay cobertura. Alcanza una firma escaneada o una
// foto de la hoja firmada (guía interna).

export async function registrarAnexo(id: string, fechaFirma: Date, file: MultipartFile, userId: string) {
  const p = await cargarPoliza(id);
  const saved = await saveUploadedFile(file, p.projectId);
  const att = await prisma.fileAttachment.create({
    data: {
      projectId: p.projectId,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      tipo: FileAttachmentTipo.OTRO,
      toolSource: TOOL_SOURCE_ANEXO,
      toolEntityId: id,
      uploadedById: userId,
    },
  });
  const anterior = p.anexoFileId;
  await prisma.seguroGranizoPoliza.update({
    where: { id },
    data: { anexoFirmadoEn: startOfUtcDay(fechaFirma), anexoFileId: att.id },
  });
  if (anterior) await borrarArchivoAnexo(anterior);
  await auditar(
    userId,
    id,
    p.projectId,
    AuditAction.file_uploaded,
    `Anexo A (solicitud de adhesión) del plan de granizo firmado el ${fmtFecha(fechaFirma)}: '${saved.filename}'`,
  );
  return getPoliza(id);
}

async function borrarArchivoAnexo(fileId: string) {
  const f = await prisma.fileAttachment.findUnique({ where: { id: fileId } });
  if (!f || f.deletedAt) return;
  await prisma.fileAttachment.update({ where: { id: f.id }, data: { deletedAt: new Date() } });
  await deleteStoredFile(f.url).catch(() => undefined);
}

export async function quitarAnexo(id: string, userId: string) {
  const p = await cargarPoliza(id);
  if (!p.anexoFileId) throw badRequest("SIN_ANEXO", "El plan no tiene Anexo A cargado");
  await prisma.seguroGranizoPoliza.update({ where: { id }, data: { anexoFirmadoEn: null, anexoFileId: null } });
  await borrarArchivoAnexo(p.anexoFileId);
  await auditar(userId, id, p.projectId, AuditAction.deleted, "Anexo A del plan de granizo quitado");
  return getPoliza(id);
}

// ─── Ampliaciones ────────────────────────────────────────────────────────────
// Condiciones, sección 3: si Voltia amplía la instalación, los paneles nuevos se
// suman al plan desde su puesta en marcha y se cobra la parte proporcional a los
// meses que faltan hasta la próxima anualidad. Un mes empezado cuenta entero.

export function mesesHasta(desde: Date, hasta: Date): number {
  const dias = Math.max(0, Math.round((startOfUtcDay(hasta).getTime() - startOfUtcDay(desde).getTime()) / 86_400_000));
  return Math.min(12, Math.max(1, Math.ceil(dias / (365 / 12))));
}

// Ampliaciones de la obra (proyectos hijos) que todavía no se sumaron al plan.
export async function ampliacionesPendientes(polizaId: string) {
  const p = await cargarPoliza(polizaId);
  const hijos = await prisma.project.findMany({
    where: { parentProjectId: p.projectId, deletedAt: null },
    select: { id: true, code: true, clientName: true, postHabilitacionInicioEn: true, actualUteEnd: true },
  });
  const ya = new Set(p.ampliaciones.map((a) => a.projectId));
  const out = [];
  for (const h of hijos.filter((x) => !ya.has(x.id))) {
    out.push({
      projectId: h.id,
      code: h.code,
      clientName: h.clientName,
      panelesSugeridos: (await panelesDeUnifilar(h.id)) ?? (await panelesDePropuesta(h.id)),
      puestaEnMarcha: toDateOnlyString(getAnclaMantenimiento(h)),
    });
  }
  return out;
}

export async function agregarAmpliacion(
  polizaId: string,
  input: { projectId: string; paneles: number; desde: Date },
  userId: string,
) {
  const p = await cargarPoliza(polizaId);
  if (p.estado === SeguroGranizoEstado.CANCELADA) throw badRequest("PLAN_DADO_DE_BAJA", "El plan está dado de baja");
  const hijo = await prisma.project.findFirst({ where: { id: input.projectId, parentProjectId: p.projectId } });
  if (!hijo) throw badRequest("NO_ES_AMPLIACION", "Ese proyecto no es una ampliación de esta obra");
  const desde = startOfUtcDay(input.desde);
  const periodo =
    p.periodos.find((x) => x.desde.getTime() <= desde.getTime() && desde.getTime() < x.hasta.getTime()) ??
    [...p.periodos].reverse().find((x) => x.desde.getTime() > desde.getTime()) ??
    null;

  await prisma.$transaction(async (tx) => {
    const paneles = p.cantidadPaneles + input.paneles;
    const precio = Number(p.precioPorPanelUsd);
    await tx.seguroGranizoPoliza.update({
      where: { id: polizaId },
      data: { cantidadPaneles: paneles, montoAnualUsd: new Prisma.Decimal(redondear(precio * paneles)) },
    });
    // Sin anualidad en curso (plan que todavía no arrancó, o ampliación anterior
    // al inicio): los paneles entran en la primera anualidad, sin cobro aparte.
    if (!periodo || periodo.desde.getTime() >= desde.getTime()) {
      for (const per of p.periodos) {
        if (periodoPagado(per)) continue;
        await tx.seguroGranizoPeriodo.update({
          where: { id: per.id },
          data: { cantidadPaneles: per.cantidadPaneles + input.paneles, montoUsd: new Prisma.Decimal(redondear(Number(per.precioPorPanelUsd) * (per.cantidadPaneles + input.paneles))) },
        });
        if (per.financeMovement && !per.financeMovement.deletedAt) {
          await tx.financeMovement.update({
            where: { id: per.financeMovement.id },
            data: { monto: new Prisma.Decimal(redondear(Number(per.precioPorPanelUsd) * (per.cantidadPaneles + input.paneles))) },
          });
        }
      }
      await tx.seguroGranizoAmpliacion.create({
        data: { polizaId, projectId: input.projectId, paneles: input.paneles, desde, hasta: desde, meses: 0, montoUsd: new Prisma.Decimal(0), creadoPorId: userId },
      });
      return;
    }
    const meses = mesesHasta(desde, periodo.hasta);
    const monto = redondear((Number(periodo.precioPorPanelUsd) * input.paneles * meses) / 12);
    // El límite anual de reposición cuenta los paneles nuevos desde ya.
    await tx.seguroGranizoPeriodo.update({
      where: { id: periodo.id },
      data: { cantidadPaneles: periodo.cantidadPaneles + input.paneles },
    });
    const amp = await tx.seguroGranizoAmpliacion.create({
      data: { polizaId, projectId: input.projectId, paneles: input.paneles, desde, hasta: periodo.hasta, meses, montoUsd: new Prisma.Decimal(monto), creadoPorId: userId },
    });
    const mov = await tx.financeMovement.create({
      data: {
        fecha: desde,
        mes: desde.getUTCMonth() + 1,
        anio: desde.getUTCFullYear(),
        tipoMovimiento: TipoMovimiento.INGRESO,
        categoriaPrincipal: CategoriaPrincipal.SEGURO_GRANIZO,
        descripcion: `Plan granizo · ampliación de ${input.paneles} paneles (${meses} ${meses === 1 ? "mes" : "meses"} hasta ${fmtFecha(periodo.hasta)})`,
        monto: new Prisma.Decimal(monto),
        moneda: Moneda.USD,
        status: FinanceMovementStatus.PREVISTO,
        cobrado: false,
        impactaFlujo: true,
        dueDate: desde,
        projectId: p.projectId,
        creadoPorId: userId,
      },
    });
    await tx.seguroGranizoAmpliacion.update({ where: { id: amp.id }, data: { financeMovementId: mov.id } });
  });

  await auditar(
    userId,
    polizaId,
    p.projectId,
    AuditAction.updated,
    `Ampliación ${hijo.code} sumada al plan de granizo: ${input.paneles} paneles desde ${fmtFecha(desde)}`,
  );
  return getPoliza(polizaId);
}

export async function marcarCobroAmpliacion(
  ampliacionId: string,
  input: { estado: "PAGADO" | "PREVISTO"; fechaPago?: Date | null },
  userId: string,
) {
  const a = await prisma.seguroGranizoAmpliacion.findUnique({ where: { id: ampliacionId }, include: { financeMovement: true, poliza: true } });
  if (!a || !a.financeMovement || a.financeMovement.deletedAt) throw notFound("SIN_COBRO", "Esa ampliación no tiene cobro");
  const fecha = input.estado === "PAGADO" ? startOfUtcDay(input.fechaPago ?? new Date()) : a.desde;
  await prisma.financeMovement.update({
    where: { id: a.financeMovement.id },
    data: {
      status: input.estado === "PAGADO" ? FinanceMovementStatus.PAGADO : FinanceMovementStatus.PREVISTO,
      cobrado: input.estado === "PAGADO",
      fecha,
      mes: fecha.getUTCMonth() + 1,
      anio: fecha.getUTCFullYear(),
    },
  });
  await auditar(userId, a.polizaId, a.poliza.projectId, AuditAction.updated, `Cobro de la ampliación del plan de granizo ${input.estado === "PAGADO" ? `cobrado el ${fmtFecha(fecha)}` : "vuelto a previsto"}`);
  return getPoliza(a.polizaId);
}

// ─── Fotos de inicio ─────────────────────────────────────────────────────────

function mapArchivo(f: { id: string; filename: string; createdAt: Date }) {
  return {
    id: f.id,
    filename: f.filename,
    thumbnailUrl: `/api/seguro-granizo/archivos/${f.id}?thumb=1`,
    fullUrl: `/api/seguro-granizo/archivos/${f.id}`,
    createdAt: f.createdAt.toISOString(),
  };
}

export async function listarFotosInicio(polizaId: string) {
  const rows = await prisma.fileAttachment.findMany({
    where: { toolSource: TOOL_SOURCE_FOTOS_INICIO, toolEntityId: polizaId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapArchivo);
}

export async function subirFotoInicio(polizaId: string, file: MultipartFile, userId: string) {
  const p = await cargarPoliza(polizaId);
  const saved = await saveObraPhoto(file, p.projectId);
  const att = await prisma.fileAttachment.create({
    data: {
      projectId: p.projectId,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      tipo: FileAttachmentTipo.OTRO,
      toolSource: TOOL_SOURCE_FOTOS_INICIO,
      toolEntityId: polizaId,
      uploadedById: userId,
    },
  });
  await createAuditEntry({
    entityType: AuditEntityType.file,
    entityId: att.id,
    projectId: p.projectId,
    userId,
    action: AuditAction.file_uploaded,
    description: `Subió foto de inicio del plan de granizo: '${saved.filename}'`,
  });
  return mapArchivo(att);
}

export async function borrarFotoInicio(polizaId: string, fileId: string, userId: string) {
  const f = await prisma.fileAttachment.findFirst({
    where: { id: fileId, toolSource: TOOL_SOURCE_FOTOS_INICIO, toolEntityId: polizaId, deletedAt: null },
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
    description: `Eliminó foto de inicio del plan de granizo '${f.filename}'`,
  });
}
