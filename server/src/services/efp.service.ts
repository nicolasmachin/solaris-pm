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

const SYSTEM_PROMPT = `Sos un asistente especializado en redactar proyectos finales de ingeniería de sistemas fotovoltaicos residenciales y comerciales en Uruguay para la empresa Voltia.

Tu trabajo es integrar la información de la pre-ingeniería + datos del proyecto + visitas técnicas relevadas en obra, y generar un borrador del Proyecto Final de Ingeniería estructurado en 7 secciones fijas.

Este borrador será luego editado por el proyectista, así que debe ser un punto de partida sólido pero no se espera que sea perfecto.

REGLAS:
1. Devolvé SOLO un JSON válido, sin markdown alrededor, sin explicaciones antes o después.
2. Si una sección no tiene info suficiente, ponela como "Pendiente de completar por el proyectista" e indicá brevemente qué falta.
3. Sintetizá info de pre-ingeniería + datos del proyecto + visitas. NO inventes datos técnicos (potencias, calibres, calibres exactos de protecciones, etc).
4. Para cada sección, redactá en markdown con bullets cuando ayuden y prosa cuando aporte.
5. Si hay información contradictoria entre pre-ingeniería y visita técnica, prevalece la visita (es el dato más actualizado del sitio real) y dejá una nota indicando la diferencia.
6. La checklist debe listar 3 a 6 puntos accionables que el proyectista tiene que verificar/completar en cada sección.

ESTRUCTURA DEL JSON:
{
  "sections": {
    "datosGenerales": "markdown",
    "resumenEjecutivo": "markdown",
    "analisisSitio": "markdown",
    "equipamiento": "markdown",
    "disenoElectrico": "markdown",
    "disenoMecanico": "markdown",
    "anexos": "markdown con lista de docs/fotos disponibles"
  },
  "checklist": {
    "datosGenerales": ["punto 1 a verificar", "punto 2", ...],
    "resumenEjecutivo": [...],
    "analisisSitio": [...],
    "equipamiento": [...],
    "disenoElectrico": [...],
    "disenoMecanico": [...],
    "anexos": [...]
  },
  "changesFromPrevious": "qué cambió respecto a versión anterior. null si es la primera."
}

ESTILO:
- Español rioplatense
- Profesional, técnico, sin emojis
- Listas con bullets cuando ayudan, prosa cuando aporta
- Concreto: si tenés un dato (modelo de inversor, cantidad de paneles), usalo`;

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
    potenciaPaneles: string | null;
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
      prompt += `Cantidad de inputs cargados: ${v.inputsCount}\n`;
      if (v.latestReport) {
        prompt += `\nÚltimo informe de la visita (v${v.latestReport.version}):\nResumen: ${v.latestReport.summary ?? "(sin resumen)"}\nSecciones:\n${JSON.stringify(v.latestReport.content, null, 2)}\n`;
      } else {
        prompt += `(La visita aún no tiene informe generado.)\n`;
      }
    });
  } else {
    prompt += `\n# VISITAS TÉCNICAS\n(No se seleccionó ninguna visita o no hay visitas cargadas. Marcá las carencias en el checklist.)\n`;
  }

  if (previousEFPVersion) {
    prompt += `\n# VERSIÓN ANTERIOR DEL PROYECTO FINAL (v${previousEFPVersion.version})

${JSON.stringify(previousEFPVersion.content, null, 2)}

Generá la nueva versión integrando los inputs actualizados. En "changesFromPrevious" indicá qué cambió respecto a v${previousEFPVersion.version}.
`;
  }

  prompt += `\n# TAREA

Generá el Proyecto Final de Ingeniería en formato JSON según las reglas del system prompt. Asegurate de:
- Llenar las 7 secciones aunque algunas tengan info parcial.
- Producir checklists accionables (qué tiene que verificar el proyectista).
- Mencionar carencias importantes en cada sección si faltan datos clave.`;

  return prompt;
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

// Schema JSON crudo que se le pasa a Claude vía tool_use. Equivalente al Zod
// de arriba, pero como JSONSchema (que es lo que entiende la API).
const EFP_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    sections: {
      type: "object",
      properties: {
        datosGenerales: { type: "string" },
        resumenEjecutivo: { type: "string" },
        analisisSitio: { type: "string" },
        equipamiento: { type: "string" },
        disenoElectrico: { type: "string" },
        disenoMecanico: { type: "string" },
        anexos: { type: "string" },
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
      properties: {
        datosGenerales: { type: "array", items: { type: "string" } },
        resumenEjecutivo: { type: "array", items: { type: "string" } },
        analisisSitio: { type: "array", items: { type: "string" } },
        equipamiento: { type: "array", items: { type: "string" } },
        disenoElectrico: { type: "array", items: { type: "string" } },
        disenoMecanico: { type: "array", items: { type: "string" } },
        anexos: { type: "array", items: { type: "string" } },
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
    changesFromPrevious: { type: ["string", "null"] },
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
    },
  });

  return {
    version,
    metadata: { modelUsed: DEFAULT_MODEL, tokensInput, tokensOutput, costUsd, latencyMs },
  };
}
