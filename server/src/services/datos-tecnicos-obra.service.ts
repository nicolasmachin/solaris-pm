import { PhaseType, Prisma, type TipoRed } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

/**
 * Datos de la obra que Operaciones necesita para agendar: cuántos paneles, el
 * inversor, mono o tri, el techo y si los paneles van coplanares o inclinados.
 *
 * La fuente es el formulario de **pre-ingeniería** (última versión), que es
 * donde Ingeniería los define. Se validan contra el **unifilar** (la última
 * versión de cada suministro): tienen que coincidir los dos.
 *
 * Regla dura (oct-2026): la Pre-Ingeniería no cierra con `faltantes`, para que
 * Validación de Operaciones reciba la obra con esto definido.
 */

export interface FaltanteDatosTecnicos {
  codigo:
    | "PREINGENIERIA"
    | "PANELES"
    | "INVERSOR"
    | "FASE"
    | "TECHO"
    | "INCLINACION"
    | "UNIFILAR"
    | "PANELES_NO_COINCIDEN"
    | "INVERSOR_NO_COINCIDE"
    | "FASE_NO_COINCIDE";
  mensaje: string;
}

export interface DatosTecnicosObra {
  preIngenieria: {
    versionNumber: number;
    cantidadPaneles: number | null;
    cantidadPanelesTexto: string | null;
    potenciaPanelW: number | null;
    inversor: string | null;
    inversorKw: number | null;
    red: PhaseType[];
    techo: string | null;
    inclinacion: "COPLANAR" | "INCLINADO" | null;
  } | null;
  unifilar: {
    /** Versión vigente de cada suministro que tiene unifilar. */
    versiones: { suministro: number; versionNumber: number }[];
    /** Suministros del proyecto que todavía no tienen unifilar. */
    suministrosSinUnifilar: number[];
    cantidadPaneles: number;
    inversorKw: number;
    red: PhaseType[];
  } | null;
  propuesta: {
    versionNumber: number;
    tipoMontaje: string | null;
    cantidadPaneles: number | null;
    potenciaInversorKw: number | null;
  } | null;
  faltantes: FaltanteDatosTecnicos[];
}

const FASE_LABEL: Record<PhaseType, string> = {
  MONOFASICO: "monofásica",
  TRIFASICO_230: "trifásica 230V",
  TRIFASICO_400: "trifásica 400V",
};

const TECHO_LABEL: Record<string, string> = {
  ISOPANEL: "Isopanel",
  HORMIGON: "Hormigón",
  CHAPA: "Chapa",
  TEJAS: "Tejas",
  SUELO: "Suelo",
};

function techoLabel(tipoTecho: string | null, tipoTechoOtro: string | null): string | null {
  if (!tipoTecho) return null;
  if (tipoTecho === "OTRO") return tipoTechoOtro?.trim() || null;
  return TECHO_LABEL[tipoTecho] ?? tipoTecho;
}

/** "Hormigón · inclinado" para la lista de proyectos; null si no hay pre-ingeniería con techo. */
export function montajeDePreIngenieria(
  v: { tipoTecho: string | null; tipoTechoOtro: string | null; inclinacion: string | null } | undefined,
): string | null {
  if (!v) return null;
  const techo = techoLabel(v.tipoTecho, v.tipoTechoOtro);
  const incl = v.inclinacion === "COPLANAR" ? "coplanar" : v.inclinacion === "INCLINADO" ? "inclinado" : null;
  return [techo, incl].filter(Boolean).join(" · ") || null;
}

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

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getDatosTecnicosObra(projectId: string): Promise<DatosTecnicosObra> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      solarSystems: { where: { deletedAt: null }, select: { order: true } },
      preIngenieriaVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          versionNumber: true,
          cantidadPaneles: true,
          potenciaPaneles: true,
          inversor: true,
          redMonofasica: true,
          redTrifasica230SN: true,
          redTrifasica400CN: true,
          tipoTecho: true,
          tipoTechoOtro: true,
          inclinacion: true,
        },
      },
      unifilarVersions: {
        orderBy: [{ suministro: "asc" }, { versionNumber: "desc" }],
        select: { suministro: true, versionNumber: true, cantidadPaneles: true, potenciaInversorKw: true, tipoRed: true },
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
  if (!project) return { preIngenieria: null, unifilar: null, propuesta: null, faltantes: [] };

  // ── Pre-ingeniería (la fuente) ──
  const pre = project.preIngenieriaVersions[0];
  const preIngenieria = pre
    ? {
        versionNumber: pre.versionNumber,
        cantidadPaneles: parsePaneles(pre.cantidadPaneles),
        cantidadPanelesTexto: pre.cantidadPaneles,
        potenciaPanelW: pre.potenciaPaneles,
        inversor: pre.inversor?.trim() || null,
        inversorKw: parseInversorKw(pre.inversor),
        red: [
          ...(pre.redMonofasica ? [PhaseType.MONOFASICO] : []),
          ...(pre.redTrifasica230SN ? [PhaseType.TRIFASICO_230] : []),
          ...(pre.redTrifasica400CN ? [PhaseType.TRIFASICO_400] : []),
        ],
        techo: techoLabel(pre.tipoTecho, pre.tipoTechoOtro),
        inclinacion:
          pre.inclinacion === "COPLANAR" || pre.inclinacion === "INCLINADO"
            ? (pre.inclinacion as "COPLANAR" | "INCLINADO")
            : null,
      }
    : null;

  // ── Unifilar: la última versión de cada suministro ──
  const vigentes = new Map<number, (typeof project.unifilarVersions)[number]>();
  for (const v of project.unifilarVersions) if (!vigentes.has(v.suministro)) vigentes.set(v.suministro, v);
  const suministros = [...new Set([1, ...project.solarSystems.map((s) => s.order)])].sort((a, b) => a - b);
  const unifilar = vigentes.size > 0
    ? {
        versiones: [...vigentes.values()].map((v) => ({ suministro: v.suministro, versionNumber: v.versionNumber })),
        suministrosSinUnifilar: suministros.filter((n) => !vigentes.has(n)),
        cantidadPaneles: [...vigentes.values()].reduce((s, v) => s + v.cantidadPaneles, 0),
        inversorKw: round2([...vigentes.values()].reduce((s, v) => s + v.potenciaInversorKw, 0)),
        red: [...new Set([...vigentes.values()].map((v) => FASE_DE_RED[v.tipoRed]))],
      }
    : null;

  // ── Propuesta: solo de referencia ──
  const prop = project.convertedLeads.flatMap((l) => l.proposalV2Versions)[0];
  const sistemaProp = (prop?.snapshot as { data?: { sistema?: Record<string, unknown> } } | null)?.data?.sistema;
  const kwProp = num(sistemaProp?.potenciaInversorKw);
  const propuesta = prop
    ? {
        versionNumber: prop.versionNumber,
        tipoMontaje: typeof sistemaProp?.tipoMontaje === "string" && sistemaProp.tipoMontaje.trim()
          ? sistemaProp.tipoMontaje.trim()
          : null,
        cantidadPaneles: num(sistemaProp?.cantidadPaneles),
        potenciaInversorKw: kwProp != null ? kwProp * (num(sistemaProp?.cantidadInversores) ?? 1) : null,
      }
    : null;

  // ── Lo que falta para cerrar la Pre-Ingeniería ──
  const faltantes: FaltanteDatosTecnicos[] = [];
  if (!preIngenieria) {
    faltantes.push({ codigo: "PREINGENIERIA", mensaje: "Falta hacer la pre-ingeniería: de ahí salen los paneles, el inversor, la red y el montaje." });
  } else {
    const v = `En la pre-ingeniería v${preIngenieria.versionNumber}`;
    if (preIngenieria.cantidadPaneles == null) {
      faltantes.push({ codigo: "PANELES", mensaje: `${v} falta la cantidad de paneles.` });
    }
    if (preIngenieria.inversorKw == null) {
      faltantes.push({ codigo: "INVERSOR", mensaje: `${v} falta el inversor con su potencia (por ejemplo "Growatt de 10 kW").` });
    }
    if (preIngenieria.red.length === 0) {
      faltantes.push({ codigo: "FASE", mensaje: `${v} falta marcar la red: monofásica o trifásica.` });
    }
    if (!preIngenieria.techo) {
      faltantes.push({ codigo: "TECHO", mensaje: `${v} falta el tipo de techo.` });
    }
    if (!preIngenieria.inclinacion) {
      faltantes.push({ codigo: "INCLINACION", mensaje: `${v} falta indicar si los paneles van coplanares o inclinados.` });
    }
  }

  if (!unifilar) {
    faltantes.push({ codigo: "UNIFILAR", mensaje: "Falta hacer el unifilar." });
  } else {
    if (unifilar.suministrosSinUnifilar.length > 0) {
      faltantes.push({
        codigo: "UNIFILAR",
        mensaje: `Falta el unifilar del suministro ${unifilar.suministrosSinUnifilar.join(", ")}.`,
      });
    }
    if (preIngenieria) {
      const pv = `la pre-ingeniería v${preIngenieria.versionNumber}`;
      const uv = unifilar.versiones.length === 1 ? `el unifilar v${unifilar.versiones[0].versionNumber}` : "los unifilares";
      if (preIngenieria.cantidadPaneles != null && preIngenieria.cantidadPaneles !== unifilar.cantidadPaneles) {
        faltantes.push({
          codigo: "PANELES_NO_COINCIDEN",
          mensaje: `Los paneles no coinciden: ${pv} dice ${preIngenieria.cantidadPaneles} y ${uv} ${unifilar.cantidadPaneles}.`,
        });
      }
      if (preIngenieria.inversorKw != null && Math.abs(preIngenieria.inversorKw - unifilar.inversorKw) > 0.05) {
        faltantes.push({
          codigo: "INVERSOR_NO_COINCIDE",
          mensaje: `El inversor no coincide: ${pv} dice "${preIngenieria.inversor}" y ${uv} ${unifilar.inversorKw} kW.`,
        });
      }
      if (preIngenieria.red.length > 0 && unifilar.red.some((f) => !preIngenieria.red.includes(f))) {
        faltantes.push({
          codigo: "FASE_NO_COINCIDE",
          mensaje: `La red no coincide: ${pv} marca ${preIngenieria.red.map((f) => FASE_LABEL[f]).join(" y ")} y ${uv} ${unifilar.red.map((f) => FASE_LABEL[f]).join(" y ")}.`,
        });
      }
    }
  }

  return { preIngenieria, unifilar, propuesta, faltantes };
}

const FASE_DE_RED: Record<TipoRed, PhaseType> = {
  MONO_230: PhaseType.MONOFASICO,
  TRI_230_SN: PhaseType.TRIFASICO_230,
  TRI_400_CN: PhaseType.TRIFASICO_400,
};

const MARCAS_INVERSOR = ["Growatt", "Huawei", "Fronius", "SMA", "Solis", "GoodWe", "Deye", "Sungrow", "Solax"];

/** "Growatt MIN 6000 TL-X" → "Growatt"; "SUN2000-50KTL-M3" → "Huawei"; si no se reconoce, null. */
export function marcaDesdeModelo(modelo: string): string | null {
  const m = modelo.toLowerCase();
  if (m.startsWith("sun2000")) return "Huawei";
  return MARCAS_INVERSOR.find((marca) => m.includes(marca.toLowerCase())) ?? null;
}

/**
 * Al guardar un unifilar, sus datos pasan a Datos técnicos del suministro: es el
 * formulario que llena Ingeniería con los números definitivos, así no se cargan
 * dos veces. Pisa paneles, potencia del panel, inversor y fase; la marca solo si
 * falta (el unifilar no la tiene como campo). Si el suministro no tenía sistema,
 * lo crea. Devuelve qué cambió, para la auditoría.
 */
export async function volcarUnifilarEnSistema(input: {
  projectId: string;
  suministro: number;
  tipoRed: TipoRed;
  cantidadPaneles: number;
  potenciaPanelW: number;
  modeloPanel: string | null;
  modeloInversor: string;
  potenciaInversorKw: number;
}): Promise<string[]> {
  const actual = await prisma.solarSystem.findFirst({
    where: { projectId: input.projectId, order: input.suministro, deletedAt: null },
  });

  // Un suministro = un inversor. Si ya había N inversores iguales que suman lo
  // mismo, se respeta; si no, queda uno con la potencia del unifilar.
  const mismaSuma = actual?.inverterPowerKw != null
    && Math.abs(Number(actual.inverterPowerKw) * (actual.inverterQuantity ?? 1) - input.potenciaInversorKw) < 0.05;
  const data = {
    panelQuantity: input.cantidadPaneles,
    panelPowerW: input.potenciaPanelW,
    ...(input.modeloPanel ? { panelModel: input.modeloPanel } : {}),
    inverterModel: input.modeloInversor,
    ...(mismaSuma ? {} : { inverterPowerKw: new Prisma.Decimal(input.potenciaInversorKw), inverterQuantity: 1 }),
    inverterPhaseType: FASE_DE_RED[input.tipoRed],
    ...(!actual?.inverterBrand?.trim() && marcaDesdeModelo(input.modeloInversor)
      ? { inverterBrand: marcaDesdeModelo(input.modeloInversor) }
      : {}),
  };

  if (!actual) {
    await prisma.solarSystem.create({ data: { projectId: input.projectId, order: input.suministro, ...data } });
    return ["sistema creado"];
  }

  const cambios: string[] = [];
  if (actual.panelQuantity !== data.panelQuantity) cambios.push(`paneles ${actual.panelQuantity ?? "—"} → ${data.panelQuantity}`);
  if (actual.panelPowerW !== data.panelPowerW) cambios.push(`panel ${actual.panelPowerW ?? "—"}W → ${data.panelPowerW}W`);
  if (!mismaSuma) cambios.push(`inversor ${actual.inverterPowerKw ?? "—"} kW → ${input.potenciaInversorKw} kW`);
  if (actual.inverterModel !== data.inverterModel) cambios.push(`modelo "${actual.inverterModel ?? "—"}" → "${data.inverterModel}"`);
  if (actual.inverterPhaseType !== data.inverterPhaseType) cambios.push(`fase ${actual.inverterPhaseType ?? "—"} → ${data.inverterPhaseType}`);
  if ("inverterBrand" in data) cambios.push(`marca → ${data.inverterBrand}`);
  if (cambios.length > 0) {
    await prisma.solarSystem.update({ where: { id: actual.id }, data });
  }
  return cambios;
}
