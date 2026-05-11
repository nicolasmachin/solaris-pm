// Generador del Proyecto Final de Ingeniería (EFP) con Claude.
// Pipeline:
//   1. Recolectar inputs: datos del proyecto + materiales + última pre-ingeniería
//      + visitas técnicas seleccionadas con sus últimos informes.
//   2. Construir prompt con todo el contexto.
//   3. Llamar Claude → JSON con { sections: { ...7 secciones }, checklist: { ...7 listas },
//      changesFromPrevious }.
//   4. Crear EFPVersion (correlativa por EFP) con el contenido + métricas.
//
// Nota: la edición inline NO usa este servicio. Solo PATCH del content. Snapshot
// manual ("Crear nueva versión") tampoco — duplica la versión actual sin IA.

import Anthropic from "@anthropic-ai/sdk";
import type { EFPVersion } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import {
  parseCantidadPaneles,
  parsePotenciaPanelesW,
  type SnapshotMaterials,
  type SnapshotPreIng,
  type SnapshotProject,
  type SnapshotUte,
} from "./efp.snapshots.types.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_MODEL = process.env.EFP_MODEL ?? "claude-sonnet-4-5-20250929";

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!ANTHROPIC_API_KEY) {
    throw new AppError(500, "ANTHROPIC_NOT_CONFIGURED", "ANTHROPIC_API_KEY no está configurada");
  }
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return anthropicClient;
}

export const EFP_SECTION_KEYS = [
  "datosGenerales",
  "resumenEjecutivo",
  "analisisSitio",
  "equipamiento",
  "disenoElectrico",
  "disenoMecanico",
  "anexos",
] as const;

export type EFPSectionKey = (typeof EFP_SECTION_KEYS)[number];

export type EFPContent = Record<EFPSectionKey, string>;
export type EFPChecklist = Record<EFPSectionKey, string[]>;

export const EFP_SECTION_TITLES: Record<EFPSectionKey, string> = {
  datosGenerales: "1. Datos generales del proyecto",
  resumenEjecutivo: "2. Resumen ejecutivo del sistema",
  analisisSitio: "3. Análisis del sitio",
  equipamiento: "4. Equipamiento y materiales",
  disenoElectrico: "5. Diseño eléctrico",
  disenoMecanico: "6. Diseño mecánico / instalación física",
  anexos: "7. Anexos",
};

const EFPJsonSchema = z.object({
  sections: z.object({
    datosGenerales: z.string(),
    resumenEjecutivo: z.string(),
    analisisSitio: z.string(),
    equipamiento: z.string(),
    disenoElectrico: z.string(),
    disenoMecanico: z.string(),
    anexos: z.string(),
  }),
  checklist: z.object({
    datosGenerales: z.array(z.string()).default([]),
    resumenEjecutivo: z.array(z.string()).default([]),
    analisisSitio: z.array(z.string()).default([]),
    equipamiento: z.array(z.string()).default([]),
    disenoElectrico: z.array(z.string()).default([]),
    disenoMecanico: z.array(z.string()).default([]),
    anexos: z.array(z.string()).default([]),
  }),
  changesFromPrevious: z.string().nullable().optional(),
});

const SYSTEM_PROMPT = `Sos un proyectista senior de sistemas fotovoltaicos en Uruguay para Voltia. Tu trabajo es redactar el Proyecto Final de Ingeniería basado en pre-ingeniería + datos del proyecto + visitas técnicas de relevamiento.

REGLAS DE ORO (no negociables):

1. CONCISIÓN: Cada sección es CORTA y DIRECTA. No redactes como tesis, sino como memo técnico. Un proyectista experimentado no necesita explicaciones largas. El PDF final tiene que tener entre 6 y 10 páginas en total — NO 19.

2. CERO REPETICIÓN: Cada dato/observación va EN UNA SOLA sección. Si lo mencionás en "Análisis del sitio", NO lo repetís en "Resumen ejecutivo" ni en "Diseño eléctrico". Asignación clara:

   - Datos generales: cliente, dirección, ubicación, modalidad de pago, características administrativas. NADA técnico acá.
   - Resumen ejecutivo: síntesis del sistema en bullets de 1-2 líneas (potencia, paneles, inversor, tipo de red). Solo particularidades CRÍTICAS que afecten el diseño. Nada de detalle.
   - Análisis del sitio: techo (tipo, pendiente, estado), sombras, orientación, INSTALACIÓN ELÉCTRICA EXISTENTE relevada en visita, trabajos de normalización requeridos. Acá van las discrepancias entre pre-ingeniería y visita.
   - Equipamiento: SOLO lista de qué materiales se usan (modelos, cantidades). NO el dónde/cómo se instalan.
   - Diseño eléctrico: cálculos, protecciones DC y AC, conexionado, puesta a tierra, monitoreo. NO repitas la lista de materiales que ya está en Equipamiento.
   - Diseño mecánico: layout de paneles, sistema de montaje, anclajes, cargas. NO repitas orientación del techo (eso va en Análisis).
   - Anexos: SOLO lista de archivos adjuntos disponibles. NUNCA redactes contenido técnico ahí.

3. ESTILO:
   - Español rioplatense, profesional, técnico.
   - Bullets cortos, no párrafos largos.
   - Sin sub-headers internos (nada de H3/H4 dentro de las secciones). Usar bullets o tablas en markdown.
   - Sin emojis.
   - Sin frases de relleno tipo "Es importante mencionar que…", "Cabe destacar…", "El presente proyecto…".

4. DATOS:
   - Si tenés el dato, decilo claro y concreto.
   - Si NO tenés el dato, ponelo como ítem de la CHECKLIST de esa sección, no como párrafo dentro del contenido. Evitá la frase "Pendiente de completar por el proyectista" repetida — eso no es información para el lector del PDF.
   - NO inventes datos técnicos (calibres, modelos, cargas, etc.).

5. DISCREPANCIAS: Si hay contradicción entre pre-ingeniería y visita, mencionarla UNA SOLA VEZ en "Análisis del sitio" y agregá un ítem en checklist "validar dimensiones".

6. ANEXOS = LISTA DE ARCHIVOS:
   Ejemplo correcto:
   "Documentación adjunta:
   - 5 fotografías del relevamiento (visita 5/5/2026)
   - Pre-ingeniería v1
   - Presupuesto de materiales (45 ítems)
   - Pendiente: datasheets de equipos"

   Ejemplo INCORRECTO: redactar de nuevo el sistema, repetir info técnica, agregar conclusiones.

7. CHECKLIST POR SECCIÓN:
   - 3 a 5 ítems accionables MAXIMO por sección.
   - Cada ítem es lo que el proyectista debe verificar o completar para cerrar esa sección.
   - Tono imperativo: "Verificar X", "Confirmar Y", "Cargar datasheet de Z".

OBJETIVO FINAL: PDF de 6 a 10 páginas, sin repetición, info bien asignada por sección. Pensá como ingeniero ocupado que necesita la info justa, no como escritor académico.`;

interface BuildPromptArgs {
  project: {
    clientName: string;
    code: string;
    clientAddress: string | null;
    locationCity: string;
    locationProvince: string;
    capacityKwp: number;
    notificationPhone: string | null;
    notificationEmail: string | null;
    modalidadPago: string | null;
  };
  preIng: {
    versionNumber: number;
    label: string | null;
    snapshotNombre: string;
    snapshotDireccion: string | null;
    tipoTecho: string | null;
    tipoTechoOtro: string | null;
    infoTecho: string | null;
    alturaTecho: string | null;
    cantidadPaneles: string | null;
    potenciaPaneles: number | null;
    inversor: string | null;
    stringsLineasDc: string | null;
    cableAc: string | null;
    termicaAc: string | null;
    diferencialAc: string | null;
    largoCablesAcMts: string | null;
    largoCablesDcMts: string | null;
    redMonofasica: boolean;
    redTrifasica230SN: boolean;
    redTrifasica400CN: boolean;
    notasAdicionales: string | null;
  } | null;
  materiales: {
    nombre: string;
    cantidad: number;
    unidad: string;
    categoria: string;
    notas: string | null;
  }[];
  uteEstado: { currentStage: string; currentStatus: string; caseNumber: string | null }[];
  visits: {
    id: string;
    visitDate: Date;
    visitType: string;
    notes: string | null;
    operario: string;
    inputsCount: number;
    latestReport: { version: number; summary: string | null; content: unknown } | null;
  }[];
  previousEFPVersion: {
    version: number;
    content: unknown;
    changesFromPrevious: string | null;
  } | null;
}

function buildUserPrompt(args: BuildPromptArgs): string {
  const { project, preIng, materiales, uteEstado, visits, previousEFPVersion } = args;

  let prompt = `# DATOS DEL PROYECTO

Cliente: ${project.clientName}
Código: ${project.code}
Dirección: ${project.clientAddress ?? "—"}
Ubicación: ${project.locationCity}, ${project.locationProvince}
Capacidad pre-vendida: ${project.capacityKwp} kWp
Modalidad de pago: ${project.modalidadPago ?? "—"}
Teléfono de notificación: ${project.notificationPhone ?? "—"}
Email de notificación: ${project.notificationEmail ?? "—"}
`;

  if (uteEstado.length > 0) {
    prompt += `\n# TRÁMITE UTE\n`;
    for (const u of uteEstado) {
      prompt += `- Etapa: ${u.currentStage} · Status: ${u.currentStatus}${u.caseNumber ? ` · Caso UTE: ${u.caseNumber}` : ""}\n`;
    }
  }

  if (preIng) {
    prompt += `\n# PRE-INGENIERÍA (versión ${preIng.versionNumber}${preIng.label ? ` — ${preIng.label}` : ""})

Cliente snapshot: ${preIng.snapshotNombre}${preIng.snapshotDireccion ? ` · ${preIng.snapshotDireccion}` : ""}

## Sitio
- Tipo de techo: ${preIng.tipoTecho ?? "—"}${preIng.tipoTechoOtro ? ` (${preIng.tipoTechoOtro})` : ""}
- Información de techo: ${preIng.infoTecho ?? "—"}
- Altura de techo: ${preIng.alturaTecho ?? "—"}

## Datos eléctricos
- Cantidad de paneles: ${preIng.cantidadPaneles ?? "—"}
- Potencia de paneles: ${preIng.potenciaPaneles ?? "—"}
- Inversor: ${preIng.inversor ?? "—"}
- Strings / líneas DC: ${preIng.stringsLineasDc ?? "—"}
- Cable AC: ${preIng.cableAc ?? "—"}
- Térmica AC: ${preIng.termicaAc ?? "—"}
- Diferencial AC: ${preIng.diferencialAc ?? "—"}
- Largo cables AC (mts): ${preIng.largoCablesAcMts ?? "—"}
- Largo cables DC (mts): ${preIng.largoCablesDcMts ?? "—"}

## Tipo de red
- Monofásica: ${preIng.redMonofasica ? "sí" : "no"}
- Trifásica 230 S/N: ${preIng.redTrifasica230SN ? "sí" : "no"}
- Trifásica 400 C/N: ${preIng.redTrifasica400CN ? "sí" : "no"}

## Notas adicionales
${preIng.notasAdicionales ?? "(sin notas)"}
`;
  } else {
    prompt += `\n# PRE-INGENIERÍA\n(No hay versiones de pre-ingeniería cargadas todavía. Marcá esta carencia en el checklist.)\n`;
  }

  if (materiales.length > 0) {
    prompt += `\n# MATERIALES PRESUPUESTADOS (${materiales.length})\n`;
    for (const m of materiales) {
      prompt += `- [${m.categoria}] ${m.nombre} — ${m.cantidad} ${m.unidad}${m.notas ? ` — ${m.notas}` : ""}\n`;
    }
  } else {
    prompt += `\n# MATERIALES PRESUPUESTADOS\n(Sin materiales cargados. Marcá esta carencia en el checklist de Equipamiento.)\n`;
  }

  if (visits.length > 0) {
    prompt += `\n# VISITAS TÉCNICAS RELEVADAS (${visits.length})\n`;
    visits.forEach((v, idx) => {
      prompt += `\n## Visita ${idx + 1} — ${v.visitType.toLowerCase()} del ${v.visitDate.toISOString().slice(0, 10)} (operario: ${v.operario})\n`;
      if (v.notes) prompt += `Notas generales del operario: ${v.notes}\n`;
      if (v.latestReport) {
        prompt += `Resumen del informe (v${v.latestReport.version}): ${v.latestReport.summary ?? "(sin resumen)"}\n`;
        prompt += `Observaciones por sección:\n${formatVisitReportContent(v.latestReport.content)}\n`;
      } else {
        prompt += `(La visita aún no tiene informe generado.)\n`;
      }
    });
  } else {
    prompt += `\n# VISITAS TÉCNICAS\n(No se seleccionó ninguna visita o no hay visitas cargadas. Marcá las carencias en el checklist.)\n`;
  }

  if (previousEFPVersion) {
    prompt += `\n# VERSIÓN ANTERIOR (v${previousEFPVersion.version})

${summarizePreviousEFP(previousEFPVersion.content)}

En "changesFromPrevious" indicá brevemente qué cambia (1-3 bullets, no el detalle).
`;
  }

  prompt += `\n# TAREA

Generá el Proyecto Final de Ingeniería siguiendo las reglas del system prompt: concisión, cero repetición entre secciones, anexos solo como lista de archivos.`;

  return prompt;
}

// Aplana las 7 secciones del informe de visita como bullets legibles, en vez
// de volcar el JSON entero. Cada valor se trunca para no inflar el contexto.
function formatVisitReportContent(content: unknown): string {
  if (!content || typeof content !== "object") return "(sin observaciones)";
  const max = 600;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
    if (value == null) continue;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (!text.trim()) continue;
    const truncated = text.length > max ? `${text.slice(0, max).trim()}…` : text.trim();
    lines.push(`- ${key}: ${truncated}`);
  }
  return lines.length > 0 ? lines.join("\n") : "(sin observaciones)";
}

// Resumen muy compacto de la versión previa: el outline por sección con los
// primeros caracteres, no el contenido completo. Suficiente para que la IA
// detecte qué cambia sin que tenga que copiar todo.
function summarizePreviousEFP(content: unknown): string {
  if (!content || typeof content !== "object") return "(sin contenido)";
  const max = 200;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
    const text = typeof value === "string" ? value.trim() : "";
    const preview = text.length > max ? `${text.slice(0, max)}…` : text;
    lines.push(`- ${key} (${text.length} chars): ${preview || "(vacío)"}`);
  }
  return lines.join("\n");
}

function calculateCostUsd(modelUsed: string, tokensInput: number, tokensOutput: number): number {
  if (modelUsed.includes("haiku")) {
    return (tokensInput * 1.0) / 1_000_000 + (tokensOutput * 5.0) / 1_000_000;
  }
  return (tokensInput * 3.0) / 1_000_000 + (tokensOutput * 15.0) / 1_000_000;
}

function stripCodeFences(text: string): string {
  const m = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1].trim() : text;
}

// Schema JSON que se le pasa a Claude vía tool_use. Las descriptions per-section
// refuerzan al system prompt: cada sección tiene un alcance acotado y un techo
// orientativo de longitud para que el PDF final quede entre 6-10 páginas.
const EFP_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    sections: {
      type: "object",
      properties: {
        datosGenerales: {
          type: "string",
          description:
            "Datos del cliente, dirección, ubicación, modalidad de pago, características administrativas. Nada técnico. Máx 1 página.",
        },
        resumenEjecutivo: {
          type: "string",
          description:
            "Síntesis técnica del sistema en bullets cortos (potencia, paneles, inversor, tipo de red). Solo particularidades CRÍTICAS que afecten el diseño. Máx 1 página.",
        },
        analisisSitio: {
          type: "string",
          description:
            "Techo, sombras, orientación, instalación eléctrica existente relevada en visita, trabajos de normalización requeridos. Acá van las discrepancias entre pre-ingeniería y visita. Máx 2 páginas.",
        },
        equipamiento: {
          type: "string",
          description:
            "Lista de equipos y materiales (modelo + cantidad). Solo el QUÉ, no el dónde/cómo. NO repetir lo que va en Diseño eléctrico/mecánico. Máx 1.5 páginas.",
        },
        disenoElectrico: {
          type: "string",
          description:
            "Cálculos, protecciones DC y AC, conexionado, puesta a tierra, monitoreo. NO repetir lista de materiales. Máx 2 páginas.",
        },
        disenoMecanico: {
          type: "string",
          description:
            "Layout de paneles, sistema de montaje, anclajes, cargas estructurales. NO repetir orientación del techo (eso va en Análisis del sitio). Máx 1.5 páginas.",
        },
        anexos: {
          type: "string",
          description:
            "SOLO lista de archivos adjuntos disponibles (fotos, presupuesto, pre-ingeniería, datasheets). NUNCA redactar contenido técnico ahí. Máx 0.5 página.",
        },
      },
      required: [
        "datosGenerales",
        "resumenEjecutivo",
        "analisisSitio",
        "equipamiento",
        "disenoElectrico",
        "disenoMecanico",
        "anexos",
      ],
    },
    checklist: {
      type: "object",
      description:
        "Checklist por sección: 3 a 5 ítems accionables que el proyectista debe verificar/completar. Tono imperativo: 'Verificar X', 'Confirmar Y'.",
      properties: {
        datosGenerales: { type: "array", items: { type: "string" }, maxItems: 5 },
        resumenEjecutivo: { type: "array", items: { type: "string" }, maxItems: 5 },
        analisisSitio: { type: "array", items: { type: "string" }, maxItems: 5 },
        equipamiento: { type: "array", items: { type: "string" }, maxItems: 5 },
        disenoElectrico: { type: "array", items: { type: "string" }, maxItems: 5 },
        disenoMecanico: { type: "array", items: { type: "string" }, maxItems: 5 },
        anexos: { type: "array", items: { type: "string" }, maxItems: 5 },
      },
      required: [
        "datosGenerales",
        "resumenEjecutivo",
        "analisisSitio",
        "equipamiento",
        "disenoElectrico",
        "disenoMecanico",
        "anexos",
      ],
    },
    changesFromPrevious: {
      type: ["string", "null"],
      description:
        "Resumen breve (1-3 bullets) de qué cambió respecto a la versión anterior. null si es la primera versión.",
    },
  },
  required: ["sections", "checklist"],
};

export interface GenerateEFPResult {
  version: EFPVersion;
  metadata: {
    modelUsed: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    latencyMs: number;
  };
}

/**
 * Construye los 4 snapshots (project, preIng, ute, materiales) del proyecto
 * en el momento actual. Usado por:
 *  - generateEFPVersionWithAI: para anclar la versión que la IA acaba de crear.
 *  - el endpoint POST /efp/:id/versions/snapshot: para anclar la versión
 *    duplicada (no copia los snapshots de la versión origen — se re-capturan
 *    para reflejar el estado del momento del snapshot).
 *
 * El snapshot de preIng usa la última PreIngenieriaVersion del proyecto.
 * El snapshot UTE toma el primer UteProcess no eliminado. Los materiales
 * snapshotean ProjectMaterials con su materialItem.
 */
export async function buildEFPSnapshots(projectId: string): Promise<{
  snapshotProject: SnapshotProject;
  snapshotPreIng: SnapshotPreIng;
  snapshotUte: SnapshotUte;
  snapshotMaterials: SnapshotMaterials;
}> {
  const capturedAt = new Date().toISOString();

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      code: true,
      clientName: true,
      clientAddress: true,
      locationCity: true,
      locationProvince: true,
      capacityKwp: true,
      notificationEmail: true,
    },
  });
  if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const snapshotProject: SnapshotProject = {
    id: project.id,
    code: project.code ?? null,
    clientName: project.clientName,
    clientAddress: project.clientAddress,
    locationCity: project.locationCity,
    locationProvince: project.locationProvince,
    capacityKwp: project.capacityKwp ? Number(project.capacityKwp) : null,
    notificationEmail: project.notificationEmail,
    capturedAt,
  };

  const preIng = await prisma.preIngenieriaVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      cantidadPaneles: true,
      potenciaPaneles: true,
      inversor: true,
    },
  });
  const snapshotPreIng: SnapshotPreIng = preIng
    ? {
        versionId: preIng.id,
        version: preIng.versionNumber,
        cantidadPaneles: parseCantidadPaneles(preIng.cantidadPaneles),
        potenciaPanelesW: parsePotenciaPanelesW(preIng.potenciaPaneles),
        inversor: preIng.inversor,
        capturedAt,
      }
    : {
        versionId: null,
        version: null,
        cantidadPaneles: null,
        potenciaPanelesW: null,
        inversor: null,
        capturedAt,
      };

  const ute = await prisma.uteProcess.findFirst({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { caseNumber: true, currentStage: true, currentStatus: true },
  });
  const snapshotUte: SnapshotUte = {
    caseNumber: ute?.caseNumber ?? null,
    currentStage: ute?.currentStage ?? null,
    currentStatus: ute?.currentStatus ?? null,
    capturedAt,
  };

  const materials = await prisma.projectMaterial.findMany({
    where: { projectId },
    include: { materialItem: { select: { id: true, nombre: true, unidad: true } } },
  });
  const snapshotMaterials: SnapshotMaterials = {
    items: materials.map((m) => ({
      materialItemId: m.materialItem?.id ?? m.materialItemId,
      description: m.materialItem?.nombre ?? "(sin nombre)",
      quantity: Number(m.quantity),
      unit: m.materialItem?.unidad ?? null,
    })),
    capturedAt,
  };

  return { snapshotProject, snapshotPreIng, snapshotUte, snapshotMaterials };
}

/**
 * Crea o reusa el EngineeringFinalProject del proyecto. Idempotente.
 */
export async function ensureEFP(projectId: string): Promise<{ id: string; status: string }> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const existing = await prisma.engineeringFinalProject.findUnique({
    where: { projectId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (existing && !existing.deletedAt) return { id: existing.id, status: existing.status };

  const created = await prisma.engineeringFinalProject.create({
    data: { projectId },
    select: { id: true, status: true },
  });
  return created;
}

/**
 * Genera una nueva versión del EFP con IA. Si no existe el EFP, lo crea. La
 * versión nueva queda con número correlativo (1, 2, 3, ...).
 */
export async function generateEFPVersionWithAI(args: {
  projectId: string;
  sourceVisitIds: string[];
  generatedById: string;
}): Promise<GenerateEFPResult> {
  const { projectId, sourceVisitIds, generatedById } = args;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      clientName: true,
      code: true,
      clientAddress: true,
      locationCity: true,
      locationProvince: true,
      capacityKwp: true,
      notificationPhone: true,
      notificationEmail: true,
      modalidadPago: true,
      projectMaterials: {
        include: {
          materialItem: {
            include: { category: { select: { nombre: true } } },
          },
        },
      },
      uteProcesses: {
        where: { deletedAt: null },
        select: { currentStage: true, currentStatus: true, caseNumber: true },
      },
      preIngenieriaVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });
  if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const visits = sourceVisitIds.length
    ? await prisma.technicalVisit.findMany({
        where: {
          id: { in: sourceVisitIds },
          projectId,
          deletedAt: null,
        },
        include: {
          createdBy: { select: { name: true } },
          _count: { select: { inputs: true } },
          reports: { orderBy: { version: "desc" }, take: 1 },
        },
      })
    : [];

  if (sourceVisitIds.length > 0 && visits.length !== sourceVisitIds.length) {
    throw new AppError(
      400,
      "INVALID_VISIT_REFERENCES",
      "Alguna de las visitas seleccionadas no existe o no pertenece al proyecto",
    );
  }

  const efp = await ensureEFP(projectId);

  const lastVersion = await prisma.eFPVersion.findFirst({
    where: { efpId: efp.id },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  const preIng = project.preIngenieriaVersions[0] ?? null;
  const materiales = project.projectMaterials.map((pm) => ({
    nombre: pm.materialItem.nombre,
    cantidad: Number(pm.quantity),
    unidad: pm.materialItem.unidad,
    categoria: pm.materialItem.category?.nombre ?? "Sin categoría",
    notas: pm.notes ?? null,
  }));

  const userPrompt = buildUserPrompt({
    project: {
      clientName: project.clientName,
      code: project.code,
      clientAddress: project.clientAddress,
      locationCity: project.locationCity,
      locationProvince: project.locationProvince,
      capacityKwp: Number(project.capacityKwp),
      notificationPhone: project.notificationPhone,
      notificationEmail: project.notificationEmail,
      modalidadPago: project.modalidadPago,
    },
    preIng: preIng
      ? {
          versionNumber: preIng.versionNumber,
          label: preIng.label,
          snapshotNombre: preIng.snapshotNombre,
          snapshotDireccion: preIng.snapshotDireccion,
          tipoTecho: preIng.tipoTecho,
          tipoTechoOtro: preIng.tipoTechoOtro,
          infoTecho: preIng.infoTecho,
          alturaTecho: preIng.alturaTecho,
          cantidadPaneles: preIng.cantidadPaneles,
          potenciaPaneles: preIng.potenciaPaneles,
          inversor: preIng.inversor,
          stringsLineasDc: preIng.stringsLineasDc,
          cableAc: preIng.cableAc,
          termicaAc: preIng.termicaAc,
          diferencialAc: preIng.diferencialAc,
          largoCablesAcMts: preIng.largoCablesAcMts,
          largoCablesDcMts: preIng.largoCablesDcMts,
          redMonofasica: preIng.redMonofasica,
          redTrifasica230SN: preIng.redTrifasica230SN,
          redTrifasica400CN: preIng.redTrifasica400CN,
          notasAdicionales: preIng.notasAdicionales,
        }
      : null,
    materiales,
    uteEstado: project.uteProcesses,
    visits: visits.map((v) => ({
      id: v.id,
      visitDate: v.visitDate,
      visitType: v.visitType,
      notes: v.notes,
      operario: v.createdBy?.name ?? "—",
      inputsCount: v._count.inputs,
      latestReport: v.reports[0]
        ? {
            version: v.reports[0].version,
            summary: v.reports[0].summary,
            content: v.reports[0].content,
          }
        : null,
    })),
    previousEFPVersion: lastVersion
      ? {
          version: lastVersion.version,
          content: lastVersion.content,
          changesFromPrevious: lastVersion.changesFromPrevious,
        }
      : null,
  });

  const client = getClient();
  const t0 = Date.now();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    tools: [
      {
        name: "generate_efp_draft",
        description:
          "Generar el borrador del Proyecto Final de Ingeniería con sus 7 secciones, checklist por sección y resumen de cambios respecto a la versión anterior.",
        input_schema: EFP_TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "generate_efp_draft" },
  });
  const latencyMs = Date.now() - t0;

  console.log(
    `[efp] Claude responded in ${latencyMs}ms — stop_reason=${response.stop_reason} input=${response.usage.input_tokens} output=${response.usage.output_tokens} blocks=${response.content.map((c) => c.type).join(",")}`,
  );

  if (response.stop_reason === "max_tokens") {
    throw new AppError(
      500,
      "CLAUDE_RESPONSE_TRUNCATED",
      "La respuesta de la IA se cortó por exceder el límite de tokens. Probá con menos visitas técnicas como input.",
    );
  }

  const toolUseBlock = response.content.find((c) => c.type === "tool_use");
  let parsed: unknown;
  if (toolUseBlock && toolUseBlock.type === "tool_use") {
    parsed = toolUseBlock.input;
  } else {
    // Fallback defensivo: si Claude ignoró el tool y devolvió texto, intentamos
    // parsear el JSON crudo como antes (con limpieza de markdown wrapper).
    const textBlock = response.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new AppError(500, "CLAUDE_NO_TOOL_NOR_TEXT", "Claude no devolvió ni tool_use ni texto");
    }
    const jsonText = stripCodeFences(textBlock.text.trim());
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("[efp] JSON parse fallback failed. Raw response (primeros 1500 chars):");
      console.error(textBlock.text.slice(0, 1500));
      throw new AppError(500, "CLAUDE_INVALID_JSON", "Claude devolvió un JSON inválido");
    }
  }

  const validated = EFPJsonSchema.safeParse(parsed);
  if (!validated.success) {
    console.error(
      "[efp] Schema mismatch. Parsed keys:",
      parsed && typeof parsed === "object" ? Object.keys(parsed) : typeof parsed,
    );
    throw new AppError(
      500,
      "CLAUDE_SCHEMA_MISMATCH",
      `JSON no cumple schema: ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  const tokensInput = response.usage.input_tokens;
  const tokensOutput = response.usage.output_tokens;
  const costUsd = calculateCostUsd(DEFAULT_MODEL, tokensInput, tokensOutput);

  const snapshots = await buildEFPSnapshots(projectId);

  const version = await prisma.eFPVersion.create({
    data: {
      efpId: efp.id,
      version: nextVersion,
      content: validated.data.sections as unknown as object,
      checklist: validated.data.checklist as unknown as object,
      sourceVisitIds,
      aiGenerated: true,
      modelUsed: DEFAULT_MODEL,
      tokensInput,
      tokensOutput,
      costUsd,
      changesFromPrevious: validated.data.changesFromPrevious ?? null,
      createdById: generatedById,
      // Snapshots congelados al momento de crear esta versión. Estructura en
      // server/src/services/efp.snapshots.types.ts.
      snapshotProject: snapshots.snapshotProject as unknown as object,
      snapshotPreIng: snapshots.snapshotPreIng as unknown as object,
      snapshotUte: snapshots.snapshotUte as unknown as object,
      snapshotMaterials: snapshots.snapshotMaterials as unknown as object,
    },
  });

  return {
    version,
    metadata: { modelUsed: DEFAULT_MODEL, tokensInput, tokensOutput, costUsd, latencyMs },
  };
}
