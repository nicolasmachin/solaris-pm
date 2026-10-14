import { PhaseType, TipoMontaje } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

/**
 * Datos técnicos de la obra que Operaciones necesita para agendar (paneles,
 * inversor, fase, montaje), cruzados con lo que dijo la propuesta y lo que
 * relevó la pre-ingeniería.
 *
 * Regla dura (oct-2026): la Pre-Ingeniería no cierra sin estos datos cargados
 * y coincidiendo con la pre-ingeniería, para que Validación de Operaciones los
 * reciba definidos. `faltantes` es lo que bloquea; vacío = puede cerrar.
 */

export interface FaltanteDatosTecnicos {
  codigo:
    | "SISTEMA"
    | "PANELES"
    | "INVERSOR"
    | "FASE"
    | "MONTAJE"
    | "PANELES_NO_COINCIDEN"
    | "INVERSOR_NO_COINCIDE"
    | "FASE_NO_COINCIDE";
  mensaje: string;
}

export interface DatosTecnicosObra {
  tipoMontaje: TipoMontaje | null;
  totalPaneles: number | null;
  totalInversorKw: number | null;
  fases: PhaseType[];
  propuesta: {
    versionNumber: number;
    tipoMontaje: string | null;
    cantidadPaneles: number | null;
    potenciaInversorKw: number | null;
  } | null;
  preIngenieria: {
    versionNumber: number;
    cantidadPaneles: number | null;
    cantidadPanelesTexto: string | null;
    inversor: string | null;
    inversorKw: number | null;
    red: PhaseType[];
  } | null;
  faltantes: FaltanteDatosTecnicos[];
}

const FASE_LABEL: Record<PhaseType, string> = {
  MONOFASICO: "monofásica",
  TRIFASICO_230: "trifásica 230V",
  TRIFASICO_400: "trifásica 400V",
};

/** "12" → 12, "12 paneles" → 12, "a definir" → null. */
function parsePaneles(texto: string | null | undefined): number | null {
  const m = texto?.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** "Growatt de 10 kW" → 10, "Fronius Primo 5.0-1 de 5kW" → 5, "Huawei" → null. */
export function parseInversorKw(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const matches = [...texto.matchAll(/(\d+(?:[.,]\d+)?)\s*kw/gi)];
  if (matches.length === 0) return null;
  return Number(matches[matches.length - 1][1].replace(",", "."));
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function getDatosTecnicosObra(projectId: string): Promise<DatosTecnicosObra> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      tipoMontaje: true,
      solarSystems: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      preIngenieriaVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          versionNumber: true,
          cantidadPaneles: true,
          inversor: true,
          redMonofasica: true,
          redTrifasica230SN: true,
          redTrifasica400CN: true,
        },
      },
      convertedLeads: {
        select: {
          proposalV2Versions: {
            where: { status: "PUBLISHED" },
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { versionNumber: true, snapshot: true },
          },
        },
      },
    },
  });
  if (!project) {
    return {
      tipoMontaje: null, totalPaneles: null, totalInversorKw: null, fases: [],
      propuesta: null, preIngenieria: null, faltantes: [],
    };
  }

  const systems = project.solarSystems;
  const totalPaneles = systems.length > 0 && systems.every((s) => s.panelQuantity != null)
    ? systems.reduce((sum, s) => sum + (s.panelQuantity ?? 0), 0)
    : null;
  const totalInversorKw = systems.length > 0 && systems.every((s) => s.inverterPowerKw != null)
    ? Math.round(systems.reduce((sum, s) => sum + Number(s.inverterPowerKw) * (s.inverterQuantity ?? 1), 0) * 100) / 100
    : null;
  const fases = [...new Set(systems.map((s) => s.inverterPhaseType).filter((f): f is PhaseType => f != null))];

  const prop = project.convertedLeads.flatMap((l) => l.proposalV2Versions)[0];
  const sistemaProp = (prop?.snapshot as { data?: { sistema?: Record<string, unknown> } } | null)?.data?.sistema;
  const propuesta = prop
    ? {
        versionNumber: prop.versionNumber,
        tipoMontaje: typeof sistemaProp?.tipoMontaje === "string" && sistemaProp.tipoMontaje.trim()
          ? sistemaProp.tipoMontaje.trim()
          : null,
        cantidadPaneles: num(sistemaProp?.cantidadPaneles),
        potenciaInversorKw: num(sistemaProp?.potenciaInversorKw) != null
          ? num(sistemaProp?.potenciaInversorKw)! * (num(sistemaProp?.cantidadInversores) ?? 1)
          : null,
      }
    : null;

  const pre = project.preIngenieriaVersions[0];
  const preIngenieria = pre
    ? {
        versionNumber: pre.versionNumber,
        cantidadPaneles: parsePaneles(pre.cantidadPaneles),
        cantidadPanelesTexto: pre.cantidadPaneles,
        inversor: pre.inversor,
        inversorKw: parseInversorKw(pre.inversor),
        red: [
          ...(pre.redMonofasica ? [PhaseType.MONOFASICO] : []),
          ...(pre.redTrifasica230SN ? [PhaseType.TRIFASICO_230] : []),
          ...(pre.redTrifasica400CN ? [PhaseType.TRIFASICO_400] : []),
        ],
      }
    : null;

  const faltantes: FaltanteDatosTecnicos[] = [];
  if (systems.length === 0) {
    faltantes.push({ codigo: "SISTEMA", mensaje: "Falta cargar el sistema en Datos técnicos (paneles, inversor y fase)." });
  } else {
    if (systems.some((s) => s.panelQuantity == null || s.panelQuantity <= 0)) {
      faltantes.push({ codigo: "PANELES", mensaje: "Falta la cantidad de paneles en Datos técnicos." });
    }
    if (systems.some((s) => !s.inverterBrand?.trim() || s.inverterPowerKw == null)) {
      faltantes.push({ codigo: "INVERSOR", mensaje: "Falta el inversor (marca y potencia) en Datos técnicos." });
    }
    if (systems.some((s) => s.inverterPhaseType == null)) {
      faltantes.push({ codigo: "FASE", mensaje: "Falta indicar si es monofásico o trifásico en Datos técnicos." });
    }
  }
  if (!project.tipoMontaje) {
    faltantes.push({ codigo: "MONTAJE", mensaje: "Falta el tipo de montaje (coplanar, con ángulos, sobre hormigón o suelo)." });
  }

  // Cruce con la pre-ingeniería: solo se compara lo que se pudo leer de ella.
  if (preIngenieria) {
    const v = `pre-ingeniería v${preIngenieria.versionNumber}`;
    if (totalPaneles != null && preIngenieria.cantidadPaneles != null && totalPaneles !== preIngenieria.cantidadPaneles) {
      faltantes.push({
        codigo: "PANELES_NO_COINCIDEN",
        mensaje: `Los paneles no coinciden: Datos técnicos dice ${totalPaneles} y la ${v} dice ${preIngenieria.cantidadPaneles}.`,
      });
    }
    if (totalInversorKw != null && preIngenieria.inversorKw != null && Math.abs(totalInversorKw - preIngenieria.inversorKw) > 0.05) {
      faltantes.push({
        codigo: "INVERSOR_NO_COINCIDE",
        mensaje: `El inversor no coincide: Datos técnicos suma ${totalInversorKw} kW y la ${v} dice "${preIngenieria.inversor}".`,
      });
    }
    if (fases.length > 0 && preIngenieria.red.length > 0 && fases.some((f) => !preIngenieria.red.includes(f))) {
      faltantes.push({
        codigo: "FASE_NO_COINCIDE",
        mensaje: `La red no coincide: Datos técnicos dice ${fases.map((f) => FASE_LABEL[f]).join(" y ")} y la ${v} marca ${preIngenieria.red.map((f) => FASE_LABEL[f]).join(" y ")}.`,
      });
    }
  }

  return {
    tipoMontaje: project.tipoMontaje,
    totalPaneles,
    totalInversorKw,
    fases,
    propuesta,
    preIngenieria,
    faltantes,
  };
}
