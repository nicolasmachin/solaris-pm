// Suministros de un proyecto.
//
// Un proyecto puede llevar más de un suministro (cuenta UTE): el caso típico es
// una propuesta con inversores distintos para dos casas, dos padrones o dos
// medidores. La regla que se acordó es **un inversor, un suministro**, y cada
// suministro tiene su propio trámite con UTE (UTE los resuelve por separado) y
// puede tener otro titular.
//
// No hay una tabla "suministro": el número de suministro es la clave que une
// tres cosas que ya existían y ahora pueden repetirse dentro del proyecto:
//
//   - `SolarSystem.order`            → el inversor y los paneles.
//   - `UteDocumentConfig.suministro` → cuenta UTE y datos para los papeles.
//   - `UteProcess.suministro`        → el trámite.
//
// El suministro 1 es el principal y se comporta exactamente como antes: su
// titular y su dirección viven en Project, y su trámite es el que mueve las
// subetapas de Habilitación UTE del proyecto. Los demás guardan en su
// `UteDocumentConfig` lo que tengan distinto (titular, dirección, factura); lo
// que dejan en null es igual al proyecto.

import type { Prisma, Project, UteDocumentConfig } from "@prisma/client";
import { UteStage, UteStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  describirInversores,
  listaInversoresDistintos,
  repartirProporcional,
  resolverPanelesInversores,
} from "./proposal/inversores.js";

export const SUMINISTRO_PRINCIPAL = 1;

/**
 * Filtro del trámite principal. Todo lo que habla de "el trámite UTE del
 * proyecto" (subetapas, panel de trámites, métricas, portal, Regla de Oro) lee
 * el del suministro 1, así que un proyecto con dos suministros se sigue viendo
 * igual que antes mientras esas pantallas no sepan mostrar más de uno.
 */
export const UTE_PRINCIPAL = { suministro: SUMINISTRO_PRINCIPAL } as const;

/** Clave única de la config UTE de un suministro. */
export function uteConfigKey(projectId: string, suministro: number = SUMINISTRO_PRINCIPAL) {
  return { projectId_suministro: { projectId, suministro } };
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Números de suministro del proyecto: los de sus sistemas y los de sus trámites,
 * siempre con el 1 aunque todavía no haya nada cargado.
 */
export async function numerosDeSuministro(projectId: string, db: Db = prisma): Promise<number[]> {
  const [sistemas, tramites] = await Promise.all([
    db.solarSystem.findMany({ where: { projectId, deletedAt: null }, select: { order: true } }),
    db.uteProcess.findMany({ where: { projectId, deletedAt: null }, select: { suministro: true } }),
  ]);
  const set = new Set<number>([SUMINISTRO_PRINCIPAL]);
  for (const s of sistemas) set.add(s.order);
  for (const t of tramites) set.add(t.suministro);
  return [...set].sort((a, b) => a - b);
}

/** Datos de titular y dirección de un suministro, con el proyecto como respaldo. */
export interface DatosSuministro {
  titularNombre: string;
  titularCi: string;
  titularEmpresa: boolean;
  /** true si el suministro tiene un titular cargado distinto del proyecto. */
  titularPropio: boolean;
  calle: string;
  numCalle: string;
  localidad: string;
  departamento: string;
  facturaUtePath: string | null;
  cedulaPath: string | null;
}

type ProjectDatos = Pick<
  Project,
  | "clientName"
  | "nombreCliente"
  | "ciCliente"
  | "empresa"
  | "calle"
  | "numCalle"
  | "locationCity"
  | "locationProvince"
  | "facturaUtePath"
  | "cedulaPath"
>;

type ConfigDatos = Pick<
  UteDocumentConfig,
  | "titularNombre"
  | "titularCi"
  | "titularEmpresa"
  | "calle"
  | "numCalle"
  | "localidad"
  | "departamento"
  | "facturaUtePath"
  | "cedulaPath"
>;

const lleno = (v: string | null | undefined): v is string => typeof v === "string" && v.trim() !== "";

export function datosSuministro(
  project: ProjectDatos,
  config: ConfigDatos | null,
  suministro: number,
): DatosSuministro {
  const nombreProyecto = project.nombreCliente.trim() || project.clientName;
  // El principal no tiene datos propios: su fuente es el proyecto, como siempre.
  const c = suministro === SUMINISTRO_PRINCIPAL ? null : config;
  const titularPropio = !!c && (lleno(c.titularNombre) || lleno(c.titularCi));
  return {
    titularNombre: lleno(c?.titularNombre) ? c!.titularNombre! : nombreProyecto,
    titularCi: lleno(c?.titularCi) ? c!.titularCi! : project.ciCliente,
    titularEmpresa: c?.titularEmpresa ?? project.empresa,
    titularPropio,
    calle: lleno(c?.calle) ? c!.calle! : project.calle,
    numCalle: lleno(c?.numCalle) ? c!.numCalle! : project.numCalle,
    localidad: lleno(c?.localidad) ? c!.localidad! : project.locationCity,
    departamento: lleno(c?.departamento) ? c!.departamento! : project.locationProvince,
    // Los archivos NO caen al proyecto: la factura del suministro 1 no es la
    // del 2, y mostrarla como suya sería peor que decir que falta.
    facturaUtePath: suministro === SUMINISTRO_PRINCIPAL ? project.facturaUtePath : (c?.facturaUtePath ?? null),
    cedulaPath: suministro === SUMINISTRO_PRINCIPAL ? project.cedulaPath : (c?.cedulaPath ?? null),
  };
}

export interface SuministroResumen extends DatosSuministro {
  numero: number;
  /** "Growatt de 8 kW" (o null si el suministro todavía no tiene sistema cargado). */
  inversor: string | null;
  paneles: number | null;
  cuentaUte: string;
  uteProcessId: string | null;
  consultaSentAt: string | null;
}

function fmtKw(kw: number): string {
  return String(Math.round(kw * 100) / 100).replace(".", ",");
}

export async function listSuministros(projectId: string): Promise<SuministroResumen[]> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      clientName: true,
      nombreCliente: true,
      ciCliente: true,
      empresa: true,
      calle: true,
      numCalle: true,
      locationCity: true,
      locationProvince: true,
      facturaUtePath: true,
      cedulaPath: true,
      solarSystems: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      uteDocumentConfigs: true,
      uteProcesses: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) return [];

  const numeros = await numerosDeSuministro(projectId);
  return numeros.map((numero) => {
    const sistema = project.solarSystems.find((s) => s.order === numero) ?? null;
    const config = project.uteDocumentConfigs.find((c) => c.suministro === numero) ?? null;
    const tramite = project.uteProcesses.find((t) => t.suministro === numero) ?? null;
    const kw = sistema?.inverterPowerKw != null ? Number(sistema.inverterPowerKw) : null;
    const inversor = sistema
      ? [sistema.inverterBrand?.trim(), kw != null ? `de ${fmtKw(kw)} kW` : null].filter(Boolean).join(" ") || null
      : null;
    return {
      numero,
      inversor,
      paneles: sistema?.panelQuantity ?? null,
      cuentaUte: config?.cuentaUte ?? "",
      uteProcessId: tramite?.id ?? null,
      consultaSentAt: tramite?.consultaSentAt ? tramite.consultaSentAt.toISOString().slice(0, 10) : null,
      ...datosSuministro(project, config, numero),
    };
  });
}

/**
 * Deja creado el trámite UTE de un suministro que no es el principal. No toca
 * las subetapas del proyecto: esas las maneja el trámite del suministro 1.
 */
export async function asegurarTramiteSuministro(
  projectId: string,
  suministro: number,
  userId: string | null,
  db: Db = prisma,
): Promise<void> {
  if (suministro === SUMINISTRO_PRINCIPAL) return;
  const existe = await db.uteProcess.findFirst({
    where: { projectId, suministro, deletedAt: null },
    select: { id: true },
  });
  if (existe) return;
  await db.uteProcess.create({
    data: {
      projectId,
      suministro,
      currentStage: UteStage.CONSULTA,
      currentStatus: UteStatus.PENDIENTE,
      createdById: userId,
    },
  });
}

/**
 * Al quitar un sistema que no es el principal, su trámite se retira solo si
 * todavía no tiene nada cargado. Si ya tiene fechas o número de caso, queda: es
 * historia del trámite y la decide una persona.
 */
export async function retirarTramiteSuministroSinUso(projectId: string, suministro: number): Promise<void> {
  if (suministro === SUMINISTRO_PRINCIPAL) return;
  const tramite = await prisma.uteProcess.findFirst({
    where: { projectId, suministro, deletedAt: null },
  });
  if (!tramite) return;
  const tieneAlgo =
    !!tramite.caseNumber ||
    !!tramite.notes ||
    [
      tramite.consultaSentAt,
      tramite.caseOpenedAt,
      tramite.consultaApprovedAt,
      tramite.solicitudSentAt,
      tramite.proyectoApprovedAt,
      tramite.docs1SentAt,
      tramite.docs1ApprovedAt,
      tramite.ensayosSentAt,
      tramite.ensayosApprovedAt,
      tramite.docs2SentAt,
      tramite.finalizedAt,
    ].some((d) => d !== null);
  if (tieneAlgo) return;
  await prisma.uteProcess.update({ where: { id: tramite.id }, data: { deletedAt: new Date() } });
}

// ─── Varios sistemas en un documento único (contrato, proforma) ───────────────

type SistemaParaResumen = {
  inverterBrand: string | null;
  inverterPowerKw: Prisma.Decimal | number | null;
  inverterQuantity: number | null;
  panelQuantity: number | null;
  panelPowerW: number | null;
};

/**
 * Un proyecto con varios suministros tiene un solo contrato y una sola
 * proforma, que tienen que nombrar todos los inversores. Devuelve null con un
 * solo sistema (el caso de siempre: cada documento lo lee como antes).
 */
export function resumirSistemasVarios(sistemas: SistemaParaResumen[]): {
  inversores: { marca: string; potenciaKw: number }[];
  descripcion: string;
  potenciaTotalKw: number;
  paneles: number | null;
} | null {
  if (sistemas.length < 2) return null;
  const inversores = sistemas.flatMap((s) =>
    Array.from({ length: Math.max(1, s.inverterQuantity ?? 1) }, () => ({
      marca: s.inverterBrand?.trim() ?? "",
      potenciaKw: s.inverterPowerKw != null ? Number(s.inverterPowerKw) : 0,
    })),
  );
  const paneles = sistemas.every((s) => s.panelQuantity != null)
    ? sistemas.reduce((a, s) => a + (s.panelQuantity ?? 0), 0)
    : null;
  return {
    inversores,
    descripcion: describirInversores(inversores),
    potenciaTotalKw: Math.round(inversores.reduce((a, i) => a + i.potenciaKw, 0) * 1000) / 1000,
    paneles,
  };
}

// ─── Desde la propuesta ──────────────────────────────────────────────────────

type SistemaSnapshot = {
  cantidadPaneles?: number;
  potenciaPanelW?: number;
  marcaPaneles?: string;
  potenciaInversorKw?: number;
  cantidadInversores?: number;
  marcaInversor?: string;
  inversores?: { marca?: string; potenciaKw?: number; paneles?: number }[];
};

export interface InversorDeSuministro {
  marca: string;
  potenciaKw: number;
  paneles: number;
}

/**
 * Los suministros que pide una propuesta: uno por inversor. Devuelve null si la
 * propuesta lleva un solo inversor (el caso de siempre, que no se toca).
 */
export function suministrosDePropuesta(sistema: SistemaSnapshot | null | undefined): InversorDeSuministro[] | null {
  if (!sistema) return null;
  const paneles = typeof sistema.cantidadPaneles === "number" ? sistema.cantidadPaneles : 0;
  const distintos = listaInversoresDistintos(sistema);
  if (distintos) {
    return resolverPanelesInversores(paneles, distintos).map((i) => ({
      marca: i.marca,
      potenciaKw: i.potenciaKw,
      paneles: i.paneles,
    }));
  }
  const cantidad = typeof sistema.cantidadInversores === "number" ? sistema.cantidadInversores : 1;
  if (cantidad < 2) return null;
  const potencia = typeof sistema.potenciaInversorKw === "number" ? sistema.potenciaInversorKw : 0;
  const reparto = repartirProporcional(paneles, Array.from({ length: cantidad }, () => potencia));
  return reparto.map((p) => ({ marca: sistema.marcaInversor ?? "", potenciaKw: potencia, paneles: p }));
}

/**
 * Al convertir un lead cuya última propuesta publicada lleva más de un
 * inversor, crea un sistema por inversor (= un suministro cada uno) y el
 * trámite UTE de cada suministro extra. Si el proyecto ya tiene sistemas
 * cargados no hace nada: lo que cargó una persona manda.
 *
 * Devuelve la descripción de lo creado ("1 Growatt de 8 kW + 1 Huawei de 6 kW")
 * o null si no correspondía.
 */
export async function crearSuministrosDesdePropuesta(
  projectId: string,
  leadId: string,
  userId: string,
): Promise<string | null> {
  const version = await prisma.proposalV2Version.findFirst({
    where: { leadId, status: "PUBLISHED", discardedAt: null },
    orderBy: { versionNumber: "desc" },
    select: { snapshot: true },
  });
  const sistema = (version?.snapshot as { data?: { sistema?: SistemaSnapshot } } | null)?.data?.sistema;
  const lista = suministrosDePropuesta(sistema);
  if (!lista) return null;

  const yaTiene = await prisma.solarSystem.count({ where: { projectId, deletedAt: null } });
  if (yaTiene > 0) return null;

  await prisma.$transaction(async (tx) => {
    for (const [idx, inv] of lista.entries()) {
      const numero = idx + 1;
      await tx.solarSystem.create({
        data: {
          projectId,
          order: numero,
          description: `Suministro ${numero}`,
          inverterBrand: inv.marca || null,
          inverterPowerKw: inv.potenciaKw || null,
          inverterQuantity: 1,
          panelQuantity: inv.paneles,
          panelPowerW: typeof sistema?.potenciaPanelW === "number" ? Math.round(sistema.potenciaPanelW) : null,
          panelBrand: sistema?.marcaPaneles || null,
        },
      });
      await asegurarTramiteSuministro(projectId, numero, userId, tx);
    }
  });

  return describirInversores(lista.map((i) => ({ marca: i.marca, potenciaKw: i.potenciaKw })));
}
