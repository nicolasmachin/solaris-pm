// Panel de gestión de reportes fotovoltaicos (Experiencia Solar).
//
// Muestra TODOS los generadores —los dados de alta en la herramienta y los que
// no— para un periodo, con el estado de cada uno (semáforo) y los datos del mes.
// El "universo" son los proyectos que ya generan o son candidatos: los que
// tienen config, los generadores livianos (importados por CSV) y los que
// llegaron a habilitación UTE.

import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import {
  dateAPeriodo,
  type Periodo,
  periodoADate,
  periodoMesAnterior,
  sumarMeses,
} from "./periodo.js";
import { resolverConfigEfectiva, SELECT_PROYECTO_CONFIG } from "./config.service.js";

/** Estado de un generador para un periodo. Ordenados de "peor" a "listo". */
export type EstadoGenerador =
  | "SIN_ALTA" // no está dado de alta en la herramienta
  | "DESHABILITADO" // dado de alta pero con reporte apagado
  | "BLOQUEADO" // le falta un dato que haría salir mal los números
  | "SIN_LECTURA" // no hay lectura del mes
  | "LECTURA_INCOMPLETA" // hay lectura pero falta consumo/exportación
  | "CALCULADO" // calculado, sin PDF generado
  | "PDF_LISTO" // PDF generado, sin enviar
  | "ENVIADO"; // reporte enviado al cliente

export interface FilaPanel {
  projectId: string;
  clientName: string;
  dadoDeAlta: boolean;
  habilitado: boolean;
  origenDatos: "GROWATT" | "MANUAL" | null;
  tipoCliente: "residencial" | "empresa" | null;
  potenciaEstimada: boolean;
  /** Motivos que impiden calcular (vacío si OK). */
  bloqueosCalculo: string[];
  /** Motivos que impiden enviar (incluye los de cálculo). */
  bloqueosEnvio: string[];
  advertencias: string[];
  tieneDestinatario: boolean;

  estado: EstadoGenerador;

  // Datos del periodo (null si no hay lectura)
  generacionKwh: number | null;
  consumoKwh: number | null;
  exportacionKwh: number | null;
  lecturaCompleta: boolean;
  diasConDatos: number | null;
  diasEsperados: number | null;

  // Cálculo del periodo (null si no calculado)
  ahorroTotal: number | null;
  ahorroTotalUsd: number | null;
  retornoInversionPct: number | null;

  // Emisión vigente del periodo (última versión)
  emisionId: string | null;
  emisionVersion: number | null;
  emisionEstado: string | null;
  enviado: boolean;
}

export interface KpisPanel {
  total: number;
  dadosDeAlta: number;
  sinAlta: number;
  conLecturaCompleta: number;
  calculados: number;
  pdfListos: number;
  enviados: number;
  bloqueados: number;
}

export interface PanelReporteFv {
  periodo: Periodo;
  kpis: KpisPanel;
  generadores: FilaPanel[];
}

const dec = (v: Prisma.Decimal | null | undefined): number | null => (v == null ? null : Number(v));

/**
 * Universo de generadores del panel: los que tienen config (dados de alta) más
 * los candidatos naturales (generadores livianos o proyectos que llegaron a
 * habilitación UTE). Deja afuera el resto de la cartera (leads, obras en curso).
 */
const WHERE_UNIVERSO: Prisma.ProjectWhereInput = {
  deletedAt: null,
  OR: [
    { reporteFvConfig: { isNot: null } },
    { importedFromCsv: true },
    { postHabilitacionInicioEn: { not: null } },
    { actualUteEnd: { not: null } },
  ],
};

export async function getPanel(periodo: Periodo): Promise<PanelReporteFv> {
  const fecha = periodoADate(periodo);

  const proyectos = await prisma.project.findMany({
    where: WHERE_UNIVERSO,
    select: {
      ...SELECT_PROYECTO_CONFIG,
      reporteFvConfig: { include: { destinatarios: true } },
      reporteFvLecturas: { where: { periodo: fecha } },
      reporteFvCalculos: { where: { periodo: fecha } },
      reporteFvEmisiones: { where: { periodo: fecha }, orderBy: { version: "desc" }, take: 1 },
    },
  });

  const generadores: FilaPanel[] = proyectos.map((p) => construirFila(p));
  generadores.sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));

  const kpis: KpisPanel = {
    total: generadores.length,
    dadosDeAlta: generadores.filter((g) => g.dadoDeAlta).length,
    sinAlta: generadores.filter((g) => !g.dadoDeAlta).length,
    conLecturaCompleta: generadores.filter((g) => g.lecturaCompleta).length,
    calculados: generadores.filter((g) => g.ahorroTotal != null).length,
    pdfListos: generadores.filter((g) => g.estado === "PDF_LISTO" || g.estado === "ENVIADO").length,
    enviados: generadores.filter((g) => g.enviado).length,
    bloqueados: generadores.filter((g) => g.dadoDeAlta && g.habilitado && g.bloqueosCalculo.length > 0)
      .length,
  };

  return { periodo, kpis, generadores };
}

type ProyectoPanel = Prisma.ProjectGetPayload<{
  select: typeof SELECT_PROYECTO_CONFIG & {
    reporteFvConfig: { include: { destinatarios: true } };
    reporteFvLecturas: true;
    reporteFvCalculos: true;
    reporteFvEmisiones: true;
  };
}>;

function construirFila(p: ProyectoPanel): FilaPanel {
  const config = p.reporteFvConfig;
  const lectura = p.reporteFvLecturas[0] ?? null;
  const calculo = p.reporteFvCalculos[0] ?? null;
  const emision = p.reporteFvEmisiones[0] ?? null;

  const generacionKwh = dec(lectura?.generacionKwh);
  const consumoKwh = dec(lectura?.consumoKwh);
  const exportacionKwh = dec(lectura?.exportacionKwh);
  const lecturaCompleta =
    generacionKwh != null && consumoKwh != null && exportacionKwh != null;

  // Sin config: no dado de alta. Igual aparece en el panel, para poder darlo de alta.
  if (!config) {
    return {
      projectId: p.id,
      clientName: p.clientName,
      dadoDeAlta: false,
      habilitado: false,
      origenDatos: null,
      tipoCliente: null,
      potenciaEstimada: false,
      bloqueosCalculo: [],
      bloqueosEnvio: [],
      advertencias: [],
      tieneDestinatario: false,
      estado: "SIN_ALTA",
      generacionKwh,
      consumoKwh,
      exportacionKwh,
      lecturaCompleta,
      diasConDatos: lectura?.diasConDatos ?? null,
      diasEsperados: lectura?.diasEsperados ?? null,
      ahorroTotal: null,
      ahorroTotalUsd: null,
      retornoInversionPct: null,
      emisionId: null,
      emisionVersion: null,
      emisionEstado: null,
      enviado: false,
    };
  }

  const efectiva = resolverConfigEfectiva(config, p);
  const enviado = emision?.estado === "ENVIADO";

  return {
    projectId: p.id,
    clientName: p.clientName,
    dadoDeAlta: true,
    habilitado: config.habilitado,
    origenDatos: config.origenDatos,
    tipoCliente: efectiva.tipoCliente,
    potenciaEstimada: efectiva.potenciaEstimada,
    bloqueosCalculo: efectiva.bloqueosCalculo,
    bloqueosEnvio: efectiva.bloqueosEnvio,
    advertencias: efectiva.advertencias,
    tieneDestinatario: efectiva.destinatarios.length > 0,
    estado: resolverEstado({
      habilitado: config.habilitado,
      bloqueado: efectiva.bloqueosCalculo.length > 0,
      lectura: lectura != null,
      lecturaCompleta,
      calculado: calculo != null,
      pdf: emision != null,
      enviado,
    }),
    generacionKwh,
    consumoKwh,
    exportacionKwh,
    lecturaCompleta,
    diasConDatos: lectura?.diasConDatos ?? null,
    diasEsperados: lectura?.diasEsperados ?? null,
    ahorroTotal: dec(calculo?.ahorroTotal),
    ahorroTotalUsd: dec(calculo?.ahorroTotalUsd),
    retornoInversionPct: dec(calculo?.retornoInversionPct),
    emisionId: emision?.id ?? null,
    emisionVersion: emision?.version ?? null,
    emisionEstado: emision?.estado ?? null,
    enviado,
  };
}

function resolverEstado(s: {
  habilitado: boolean;
  bloqueado: boolean;
  lectura: boolean;
  lecturaCompleta: boolean;
  calculado: boolean;
  pdf: boolean;
  enviado: boolean;
}): EstadoGenerador {
  if (!s.habilitado) return "DESHABILITADO";
  if (s.enviado) return "ENVIADO";
  if (s.pdf) return "PDF_LISTO";
  if (s.bloqueado) return "BLOQUEADO";
  if (!s.lectura) return "SIN_LECTURA";
  if (!s.lecturaCompleta) return "LECTURA_INCOMPLETA";
  if (s.calculado) return "CALCULADO";
  // Lectura completa y sin bloqueos pero aún sin cálculo persistido.
  return "CALCULADO";
}

/**
 * Detalle de un generador: config efectiva (con lo heredado del proyecto y los
 * bloqueos), lecturas y emisiones. Alimenta el drawer del panel. Si no tiene
 * config, devuelve `dadoDeAlta: false` con los datos del proyecto para pre-llenar
 * el form de alta.
 */
export async function getDetalleGenerador(projectId: string) {
  const proyecto = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      ...SELECT_PROYECTO_CONFIG,
      reporteFvConfig: { include: { destinatarios: { orderBy: { esCopia: "asc" } } } },
    },
  });
  if (!proyecto) return null;

  const emisiones = await prisma.reporteFvEmision.findMany({
    where: { projectId },
    orderBy: [{ periodo: "desc" }, { version: "desc" }],
    select: {
      id: true,
      periodo: true,
      version: true,
      estado: true,
      fileAttachmentId: true,
      publicadoEnPortal: true,
      enviadoEn: true,
      generadoEn: true,
    },
  });

  const config = proyecto.reporteFvConfig;
  const efectiva = config ? resolverConfigEfectiva(config, proyecto) : null;

  return {
    projectId: proyecto.id,
    clientName: proyecto.clientName,
    dadoDeAlta: config != null,
    // Valores del proyecto para pre-llenar (los que heredaría la config).
    proyecto: {
      capacityKwp: dec(proyecto.capacityKwp),
      budgetUsd: dec(proyecto.budgetUsd),
      clientEmail: proyecto.clientEmail,
      mesInicioSugerido: proyecto.postHabilitacionInicioEn
        ? dateAPeriodo(proyecto.postHabilitacionInicioEn)
        : proyecto.actualUteEnd
          ? dateAPeriodo(proyecto.actualUteEnd)
          : null,
    },
    config: config
      ? {
          habilitado: config.habilitado,
          tipoCliente: efectiva!.tipoCliente,
          tarifaContratada: efectiva!.tarifaContratada,
          origenDatos: config.origenDatos,
          growattPlantId: config.growattPlantId?.toString() ?? null,
          // Valores crudos (null = hereda) para el form.
          potenciaContratadaKw: dec(config.potenciaContratadaKw),
          pctPunta: dec(config.pctPunta),
          pctLlano: dec(config.pctLlano),
          pctValle: dec(config.pctValle),
          inversionUsd: dec(config.inversionUsd),
          potenciaInstaladaKwp: dec(config.potenciaInstaladaKwp),
          mesInicio: config.mesInicio ? dateAPeriodo(config.mesInicio) : null,
          notasFijas: config.notasFijas,
          diaCorteMedidor: config.diaCorteMedidor,
          destinatarios: config.destinatarios.map((d) => ({
            email: d.email,
            nombre: d.nombre,
            esCopia: d.esCopia,
          })),
          // Valores efectivos ya resueltos + diagnóstico.
          efectivo: {
            potenciaEstimada: efectiva!.potenciaEstimada,
            heredados: efectiva!.heredados,
            bloqueosCalculo: efectiva!.bloqueosCalculo,
            bloqueosEnvio: efectiva!.bloqueosEnvio,
            advertencias: efectiva!.advertencias,
            destinatariosEfectivos: efectiva!.destinatarios,
          },
        }
      : null,
    emisiones: emisiones.map((e) => ({
      id: e.id,
      periodo: dateAPeriodo(e.periodo),
      version: e.version,
      estado: e.estado,
      tienePdf: e.fileAttachmentId != null,
      publicadoEnPortal: e.publicadoEnPortal,
      enviado: e.enviadoEn != null,
      generadoEn: e.generadoEn.toISOString(),
    })),
  };
}

/**
 * Periodos con al menos una lectura, del más reciente al más viejo. El primero
 * es el default del panel: interesa que sea un mes CON datos (no el mes en curso
 * todavía vacío). Si no hay ninguno, se ofrece el mes anterior al actual para no
 * dejar el selector vacío.
 */
/**
 * Meses que ofrece el selector del panel.
 *
 * Incluye los que ya tienen lecturas MÁS los últimos meses aunque estén vacíos.
 * Listar sólo los que tienen datos parecía razonable pero dejaba un círculo
 * vicioso: para traer los datos de un mes hay que seleccionarlo, y no se podía
 * seleccionar hasta que tuviera datos. En la práctica el mes en curso nunca
 * aparecía y no había forma de arrancar el mes desde la pantalla.
 */
export async function periodosConDatos(): Promise<Periodo[]> {
  const filas = await prisma.reporteFvLectura.findMany({
    distinct: ["periodo"],
    select: { periodo: true },
    orderBy: { periodo: "desc" },
  });

  const periodos = new Set(filas.map((f) => dateAPeriodo(f.periodo)));

  // Los últimos 12 meses cerrados, siempre disponibles para poder ingerirlos.
  // No se ofrece el mes en curso: todavía no terminó y su reporte no tiene
  // sentido hasta que cierre.
  let mes = periodoMesAnterior();
  for (let i = 0; i < 12; i++) {
    periodos.add(mes);
    mes = sumarMeses(mes, -1);
  }

  return [...periodos].sort().reverse();
}
