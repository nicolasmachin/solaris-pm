// Generador de informes técnicos de Visita Técnica con Claude.
// Pipeline:
//   1. Recolectar todos los inputs (notas + transcripciones + descripciones de fotos)
//   2. Construir contexto completo del proyecto (snapshot de campos + materiales + comments + UTE + última pre-ingeniería + último unifilar)
//   3. Si hay reporte previo, incluirlo para que Claude haga changelog
//   4. Llamar Claude → JSON estructurado con 7 secciones + summary + changelog + projectSuggestions
//   5. Persistir VisitReport con métricas y tokens

import Anthropic from "@anthropic-ai/sdk";
import type { TipoRed, VisitInput, VisitReport } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_MODEL = process.env.VISIT_REPORT_MODEL ?? "claude-sonnet-4-5-20250929";

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!ANTHROPIC_API_KEY) {
    throw new AppError(500, "ANTHROPIC_NOT_CONFIGURED", "ANTHROPIC_API_KEY no está configurada");
  }
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return anthropicClient;
}

// ─── Schema del JSON que pedimos al modelo ──────────────────────────────────

export const SECTION_KEYS = [
  "datosGenerales",
  "acometida",
  "techo",
  "espacioInversor",
  "canalizaciones",
  "observaciones",
  "proximosPasos",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export type ReportContent = Record<SectionKey, string>;

const ProjectSuggestionSchema = z.object({
  field: z.string(),
  currentValue: z.union([z.string(), z.number(), z.null()]).optional(),
  suggestedValue: z.union([z.string(), z.number(), z.null()]),
  reason: z.string(),
  confidence: z.enum(["alta", "media", "baja"]),
});

export type ProjectSuggestion = z.infer<typeof ProjectSuggestionSchema>;

const ReportJsonSchema = z.object({
  sections: z.object({
    datosGenerales: z.string(),
    acometida: z.string(),
    techo: z.string(),
    espacioInversor: z.string(),
    canalizaciones: z.string(),
    observaciones: z.string(),
    proximosPasos: z.string(),
  }),
  summary: z.string().nullable().optional(),
  changesFromPrevious: z.string().nullable().optional(),
  projectSuggestions: z.array(ProjectSuggestionSchema).optional().default([]),
});

// ─── Tipos auxiliares ────────────────────────────────────────────────────────

interface ProjectContext {
  datosGenerales: {
    cliente: string;
    direccion: string | null;
    ciudad: string;
    capacidadKwp: number;
    estado: string;
    modalidadPago: string | null;
    notificationPhone: string | null;
    notificationEmail: string | null;
  };
  tipoRedDerivado: TipoRed | null; // del último UnifilarVersion
  materiales: { nombre: string; cantidad: number; unidad: string; categoria: string; notas: string | null }[];
  comentariosRecientes: { fecha: string; autor: string; texto: string }[];
  preIngenieria: {
    versionNumber: number;
    label: string | null;
    tipoTecho: string | null;
    infoTecho: string | null;
    inversor: string | null;
    cantidadPaneles: string | null;
    notasAdicionales: string | null;
  } | null;
  uteEstado: { currentStage: string; currentStatus: string; caseNumber: string | null }[];
}

// ─── Build context ──────────────────────────────────────────────────────────

async function buildProjectContext(projectId: string): Promise<ProjectContext> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      projectMaterials: {
        include: {
          materialItem: {
            include: { category: { select: { nombre: true } } },
          },
        },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { author: { select: { name: true } } },
      },
      uteProcesses: {
        where: { deletedAt: null },
        select: { currentStage: true, currentStatus: true, caseNumber: true },
      },
      unifilarVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { tipoRed: true },
      },
      preIngenieriaVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });
  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
  }

  const decimal = (d: { toNumber: () => number } | null | undefined): number =>
    d ? d.toNumber() : 0;

  const lastPreIng = project.preIngenieriaVersions[0] ?? null;
  const lastUnifilar = project.unifilarVersions[0] ?? null;

  return {
    datosGenerales: {
      cliente: project.clientName,
      direccion: project.clientAddress ?? null,
      ciudad: `${project.locationCity}, ${project.locationProvince}`,
      capacidadKwp: decimal(project.capacityKwp),
      estado: project.status,
      modalidadPago: project.modalidadPago ?? null,
      notificationPhone: project.notificationPhone ?? null,
      notificationEmail: project.notificationEmail ?? null,
    },
    tipoRedDerivado: lastUnifilar?.tipoRed ?? null,
    materiales: project.projectMaterials.map((pm) => ({
      nombre: pm.materialItem.nombre,
      cantidad: decimal(pm.quantity),
      unidad: pm.materialItem.unidad,
      categoria: pm.materialItem.category?.nombre ?? "Sin categoría",
      notas: pm.notes ?? null,
    })),
    comentariosRecientes: project.comments.slice(0, 10).map((c) => ({
      fecha: c.createdAt.toISOString().slice(0, 10),
      autor: c.author?.name ?? "—",
      texto: c.content,
    })),
    preIngenieria: lastPreIng
      ? {
          versionNumber: lastPreIng.versionNumber,
          label: lastPreIng.label,
          tipoTecho: lastPreIng.tipoTecho,
          infoTecho: lastPreIng.infoTecho,
          inversor: lastPreIng.inversor,
          cantidadPaneles: lastPreIng.cantidadPaneles,
          notasAdicionales: lastPreIng.notasAdicionales,
        }
      : null,
    uteEstado: project.uteProcesses.map((u) => ({
      currentStage: u.currentStage,
      currentStatus: u.currentStatus,
      caseNumber: u.caseNumber,
    })),
  };
}

function buildInputsContext(inputs: VisitInput[]): string {
  if (inputs.length === 0) return "(Sin inputs cargados)";
  return inputs
    .map((input, idx) => {
      const desc = input.description ? ` (${input.description})` : "";
      if (input.type === "NOTE") {
        return `[NOTA ${idx + 1}]${desc}\n${input.noteText ?? ""}`;
      }
      if (input.type === "AUDIO") {
        if (input.transcriptionStatus === "COMPLETED" && input.transcription) {
          return `[AUDIO ${idx + 1} — transcripción]${desc}\n${input.transcription}`;
        }
        return `[AUDIO ${idx + 1}]${desc}\n(Status: ${input.transcriptionStatus ?? "PENDING"} — ignorar para esta versión, regenerar cuando esté listo)`;
      }
      if (input.type === "PHOTO") {
        return `[FOTO ${idx + 1}]${desc || "(sin descripción)"}\n(Adjunto visual — sólo metadata; no procesar imagen)`;
      }
      return `[INPUT ${idx + 1}] (tipo desconocido)`;
    })
    .join("\n\n");
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente especializado en redactar informes técnicos de visitas a obra de instalaciones fotovoltaicas residenciales y comerciales en Uruguay para la empresa Voltia.

Tu trabajo es procesar los inputs (notas escritas + audios transcriptos + descripciones de fotos) que el operario trajo de la visita técnica y generar un informe estructurado en 7 secciones fijas.

REGLAS:
1. Devolvé SOLO un JSON válido, sin markdown, sin texto antes o después, sin explicaciones.
2. Si una sección no tiene información, ponela como "Sin información relevada todavía" — no inventes datos.
3. Para cada sección, sintetizá la info de TODOS los inputs disponibles Y el contexto del proyecto.
4. Si la info nueva contradice o complementa el contexto del proyecto, mencionalo.
5. Si detectás info que sugiere actualizar campos del proyecto (capacidad, dirección, modalidad de pago, etc), agregalo en "projectSuggestions" con el field exacto del modelo Project (clientAddress, capacityKwp, etc).
6. Si hay reporte anterior, agregá un changelog corto destacando qué cambió, qué se confirmó y qué se agregó nuevo.

ESTRUCTURA DEL JSON:
{
  "sections": {
    "datosGenerales": "markdown de la sección",
    "acometida": "markdown",
    "techo": "markdown",
    "espacioInversor": "markdown",
    "canalizaciones": "markdown",
    "observaciones": "markdown",
    "proximosPasos": "markdown"
  },
  "summary": "resumen ejecutivo de 2-3 oraciones",
  "changesFromPrevious": "markdown con cambios. null si no hay reporte anterior.",
  "projectSuggestions": [
    {
      "field": "capacityKwp",
      "currentValue": 5,
      "suggestedValue": 6,
      "reason": "El operario midió un área disponible que permite 6 kWp en lugar de los 5 estimados",
      "confidence": "alta"
    }
  ]
}

ESTILO:
- Español rioplatense
- Profesional pero no rebuscado
- Listas cuando ayudan, prosa cuando aporta
- Sin emojis
- Concreto y específico`;

function buildUserPrompt(args: {
  projectContext: ProjectContext;
  inputsContext: string;
  visit: { visitDate: Date; visitType: string; notes: string | null; createdBy?: { name: string } | null };
  previousReport: VisitReport | null;
}): string {
  const { projectContext, inputsContext, visit, previousReport } = args;
  let prompt = `# CONTEXTO DEL PROYECTO

${JSON.stringify(projectContext, null, 2)}

# VISITA TÉCNICA

Fecha: ${visit.visitDate.toISOString()}
Tipo: ${visit.visitType}
Operario: ${visit.createdBy?.name ?? "—"}
Notas generales del operario: ${visit.notes || "(sin notas generales)"}

# INPUTS DEL OPERARIO

${inputsContext}
`;

  if (previousReport) {
    prompt += `\n# REPORTE ANTERIOR (versión ${previousReport.version})

${JSON.stringify(previousReport.content, null, 2)}

Resumen anterior: ${previousReport.summary ?? "(sin resumen)"}
`;
  }

  prompt += `\nGenerá ahora el informe en formato JSON según las reglas indicadas.`;
  return prompt;
}

// ─── Pricing aproximado ─────────────────────────────────────────────────────

function calculateCostUsd(
  modelUsed: string,
  tokensInput: number,
  tokensOutput: number,
): number {
  // Sonnet 4.5: $3/M input, $15/M output (precios oficiales 2025).
  // Si en el futuro cambiás el modelo, ajustar acá.
  const inputCostPer1M = 3.0;
  const outputCostPer1M = 15.0;
  if (modelUsed.includes("haiku")) {
    return ((tokensInput * 1.0) / 1_000_000) + ((tokensOutput * 5.0) / 1_000_000);
  }
  return (
    (tokensInput * inputCostPer1M) / 1_000_000 +
    (tokensOutput * outputCostPer1M) / 1_000_000
  );
}

// ─── Función pública ───────────────────────────────────────────────────────

export interface GenerateReportResult {
  report: VisitReport;
  metadata: {
    modelUsed: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    latencyMs: number;
  };
}

export async function generateVisitReport(
  visitId: string,
  generatedById: string,
): Promise<GenerateReportResult> {
  const visit = await prisma.technicalVisit.findFirst({
    where: { id: visitId, deletedAt: null },
    include: {
      createdBy: { select: { name: true } },
      inputs: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
      reports: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
  if (!visit) {
    throw new AppError(404, "VISIT_NOT_FOUND", "Visita no encontrada");
  }

  const projectContext = await buildProjectContext(visit.projectId);
  const inputsContext = buildInputsContext(visit.inputs);
  const previousReport = visit.reports[0] ?? null;
  const nextVersion = (previousReport?.version ?? 0) + 1;

  const client = getClient();
  const t0 = Date.now();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt({
          projectContext,
          inputsContext,
          visit,
          previousReport,
        }),
      },
    ],
  });
  const latencyMs = Date.now() - t0;

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AppError(500, "CLAUDE_NO_TEXT", "Claude devolvió respuesta sin texto");
  }
  const raw = textBlock.text.trim();
  const jsonText = stripCodeFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AppError(500, "CLAUDE_INVALID_JSON", "Claude devolvió un JSON inválido");
  }

  const validated = ReportJsonSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AppError(
      500,
      "CLAUDE_SCHEMA_MISMATCH",
      `JSON no cumple schema: ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  const tokensInput = response.usage.input_tokens;
  const tokensOutput = response.usage.output_tokens;
  const costUsd = calculateCostUsd(DEFAULT_MODEL, tokensInput, tokensOutput);

  const report = await prisma.visitReport.create({
    data: {
      visitId,
      version: nextVersion,
      content: validated.data.sections as unknown as object,
      summary: validated.data.summary ?? null,
      changesFromPrevious: validated.data.changesFromPrevious ?? null,
      projectSuggestions: (validated.data.projectSuggestions ?? []) as unknown as object,
      inputsUsed: visit.inputs.map((i) => i.id),
      modelUsed: DEFAULT_MODEL,
      tokensInput,
      tokensOutput,
      costUsd,
      generatedById,
    },
  });

  return {
    report,
    metadata: { modelUsed: DEFAULT_MODEL, tokensInput, tokensOutput, costUsd, latencyMs },
  };
}

function stripCodeFences(text: string): string {
  const m = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1].trim() : text;
}
