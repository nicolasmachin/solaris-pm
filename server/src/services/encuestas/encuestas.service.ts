import {
  AuditAction,
  AuditEntityType,
  NotificationType,
  type SatisfactionSurvey,
  SurveyEstado,
  SurveyTipo,
  type StageType,
  SettingKey,
  SettingLevel,
  TraspasoTipo,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { esNotaBaja, promedioNotas } from "./preguntas.js";
import { createNotification } from "../notification.service.js";
import { crearTraspasoSiNoExiste } from "../traspasos/traspasos.service.js";

// Nota <= a este umbral dispara el traspaso T11 a Experiencia Solar. Configurable
// en Administración (SettingKey.ENCUESTA_NOTA_BAJA_MAX); este es el valor por
// defecto si no está seteado. Escala 1-5.
export const NOTA_BAJA_MAX_DEFAULT = 3;

// Cache corto: lo consulta cada serialización de encuesta.
let umbralCache: { valor: number; expira: number } | null = null;

export async function getUmbralNotaBaja(): Promise<number> {
  if (umbralCache && umbralCache.expira > Date.now()) return umbralCache.valor;
  let valor = NOTA_BAJA_MAX_DEFAULT;
  try {
    const setting = await prisma.setting.findFirst({
      where: { key: SettingKey.ENCUESTA_NOTA_BAJA_MAX, level: SettingLevel.SYSTEM },
    });
    const parsed = setting?.value ? Number(setting.value) : NaN;
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) valor = parsed;
  } catch {
    // Sin config o DB no disponible → default.
  }
  umbralCache = { valor, expira: Date.now() + 5 * 60 * 1000 };
  return valor;
}

export function clearUmbralNotaBajaCache(): void {
  umbralCache = null;
}

export const SURVEY_TIPO_LABEL: Record<SurveyTipo, string> = {
  [SurveyTipo.OBRA]: "instalación",
  [SurveyTipo.HABILITACION]: "habilitación",
  [SurveyTipo.ANIVERSARIO]: "aniversario",
};

// ─── Serialización ───────────────────────────────────────────────────────────

async function resolveUserNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function serializeSurvey(s: SatisfactionSurvey) {
  const names = await resolveUserNames([s.respondidaPorId, s.createdById]);
  return {
    id: s.id,
    projectId: s.projectId,
    tipo: s.tipo,
    estado: s.estado,
    edicion: s.edicion,
    nota: s.nota,
    nota2: s.nota2,
    nota3: s.nota3,
    // Puntaje de la encuesta = promedio de las notas respondidas.
    notaPromedio: promedioNotas([s.nota, s.nota2, s.nota3]),
    comentario: s.comentario,
    notaBaja: esNotaBaja([s.nota, s.nota2, s.nota3], await getUmbralNotaBaja()),
    respondidaEn: s.respondidaEn?.toISOString() ?? null,
    respondidaPorId: s.respondidaPorId,
    respondidaPorNombre: s.respondidaPorId ? names.get(s.respondidaPorId) ?? null : null,
    traspasoId: s.traspasoId,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ─── Notificación in-app a los clientes del proyecto (NUNCA email) ───────────

async function notificarEncuestaDisponible(projectId: string, tipo: SurveyTipo) {
  try {
    const [clientes, project] = await Promise.all([
      prisma.projectClient.findMany({ where: { projectId }, select: { userId: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { clientName: true } }),
    ]);
    if (clientes.length === 0) return;
    const title = "Tenés una encuesta para responder";
    const message =
      `Contanos cómo fue tu experiencia con la ${SURVEY_TIPO_LABEL[tipo]}` +
      `${project?.clientName ? ` de "${project.clientName}"` : ""}. Entrá a Encuestas y dejanos tu opinión.`;
    for (const c of clientes) {
      await createNotification({
        userId: c.userId,
        projectId,
        type: NotificationType.encuesta_disponible,
        title,
        message,
      });
    }
  } catch (err) {
    console.error("[encuestas] no se pudo notificar al cliente:", err);
  }
}

// ─── Creación (sistema: hooks de etapa + cron de aniversario) ────────────────

// Crea una encuesta PENDIENTE solo si no existe ya una del mismo
// (proyecto, tipo, edición). Idempotente: el re-cierre de una etapa o el cron de
// aniversario no la duplican. Best-effort: nunca interrumpe la acción disparadora.
export async function crearEncuestaSiNoExiste(params: {
  projectId: string;
  tipo: SurveyTipo;
  edicion?: number;
  createdById?: string | null;
}): Promise<SatisfactionSurvey | null> {
  const edicion = params.edicion ?? 0;
  try {
    const existente = await prisma.satisfactionSurvey.findUnique({
      where: {
        projectId_tipo_edicion: { projectId: params.projectId, tipo: params.tipo, edicion },
      },
    });
    if (existente) return existente;

    const survey = await prisma.satisfactionSurvey.create({
      data: {
        projectId: params.projectId,
        tipo: params.tipo,
        edicion,
        createdById: params.createdById ?? null,
      },
    });

    // Solo auditamos si la disparó un usuario concreto; las generadas por sistema
    // (hooks de etapa / cron de aniversario) dejan traza en la propia fila.
    if (params.createdById) {
      await createAuditEntry({
        entityType: AuditEntityType.survey,
        entityId: survey.id,
        projectId: survey.projectId,
        userId: params.createdById,
        action: AuditAction.created,
        description: `Encuesta de ${SURVEY_TIPO_LABEL[params.tipo]} generada${edicion > 0 ? ` (año ${edicion})` : ""}`,
      });
    }

    await notificarEncuestaDisponible(params.projectId, params.tipo);
    return survey;
  } catch (err) {
    console.error(`[encuestas] no se pudo crear encuesta ${params.tipo} para ${params.projectId}:`, err);
    return null;
  }
}

// ─── Disparo por hito de etapa ───────────────────────────────────────────────

// Encuesta que corresponde al cierre de cada etapa del pipeline. Alineado con el
// recorrido E1→E2 (cierre de obra) y E2→E3 (finalización del trámite UTE = T8).
// Nota: proyectos legacy con la etapa HABILITACION_UTE no disparan (mismo caveat
// que T8; ya finalizados).
const STAGE_TO_SURVEY: Partial<Record<StageType, SurveyTipo>> = {
  EJECUCION_OBRA: SurveyTipo.OBRA,
  TRAMITACION_UTE: SurveyTipo.HABILITACION,
};

// Se llama junto a fireStageTraspasos cuando una etapa cierra a COMPLETED.
// Idempotente por (proyecto, tipo, edición=0) y best-effort.
export async function fireStageSurveys(stageName: StageType, projectId: string) {
  const tipo = STAGE_TO_SURVEY[stageName];
  if (!tipo) return;
  await crearEncuestaSiNoExiste({ projectId, tipo });
}

// ─── Respuesta del cliente (desde el portal) ─────────────────────────────────

export async function responderEncuesta(params: {
  surveyId: string;
  userId: string;
  nota: number;
  // Opcionales: no se exigen para no sumar fricción (tasa de respuesta ~5%).
  nota2?: number | null;
  nota3?: number | null;
  comentario?: string | null;
}): Promise<SatisfactionSurvey> {
  const valida = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;
  if (!valida(params.nota)) {
    throw badRequest("NOTA_INVALIDA", "La nota debe ser un número entero de 1 a 5.");
  }
  for (const extra of [params.nota2, params.nota3]) {
    if (extra !== undefined && extra !== null && !valida(extra)) {
      throw badRequest("NOTA_INVALIDA", "Las notas deben ser números enteros de 1 a 5.");
    }
  }

  const survey = await prisma.satisfactionSurvey.findFirst({
    where: { id: params.surveyId, deletedAt: null },
  });
  if (!survey) throw notFound("SURVEY_NOT_FOUND", "Encuesta no encontrada");
  if (survey.estado === SurveyEstado.RESPONDIDA) {
    throw badRequest("SURVEY_YA_RESPONDIDA", "Esta encuesta ya fue respondida.");
  }

  // Ownership: el usuario debe ser cliente del proyecto de la encuesta.
  const esCliente = await prisma.projectClient.findFirst({
    where: { projectId: survey.projectId, userId: params.userId },
    select: { id: true },
  });
  if (!esCliente) throw forbidden("No podés responder una encuesta de otro proyecto.");

  const comentario = params.comentario?.trim() || null;

  let traspasoId: string | null = null;
  // Nota baja → dispara T11 a Experiencia Solar. El acuse humano en Pendientes lo
  // toma el responsable de Experiencia Solar (fallback ADMIN) como modalUsuario,
  // ya que un evento originado por el cliente igual necesita un dueño interno.
  const notasRespondidas = [params.nota, params.nota2, params.nota3];
  const umbral = await getUmbralNotaBaja();
  const notaBaja = esNotaBaja(notasRespondidas, umbral);
  if (notaBaja) {
    const actorUserId = await resolverResponsableInterno();
    if (actorUserId) {
      const traspaso = await crearTraspasoSiNoExiste({
        tipo: TraspasoTipo.T11_ENCUESTA_NOTA_BAJA,
        projectId: survey.projectId,
        actorUserId,
        payload: { surveyId: survey.id, nota: params.nota, tipo: survey.tipo },
      });
      traspasoId = traspaso?.id ?? null;
    }
  }

  const updated = await prisma.satisfactionSurvey.update({
    where: { id: survey.id },
    data: {
      estado: SurveyEstado.RESPONDIDA,
      nota: params.nota,
      nota2: params.nota2 ?? null,
      nota3: params.nota3 ?? null,
      comentario,
      respondidaEn: new Date(),
      respondidaPorId: params.userId,
      traspasoId,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.survey,
    entityId: survey.id,
    projectId: survey.projectId,
    userId: params.userId,
    action: AuditAction.updated,
    description:
      `Encuesta de ${SURVEY_TIPO_LABEL[survey.tipo]} respondida: ` +
      `${notasRespondidas.filter((n) => n != null).join("/")} · promedio ${promedioNotas(notasRespondidas)}/5` +
      (notaBaja ? " (nota baja → Experiencia Solar)" : ""),
  });

  return updated;
}

// Primer usuario con rol EXPERIENCIA_SOLAR; fallback al primer ADMIN.
async function resolverResponsableInterno(): Promise<string | null> {
  const cx = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "EXPERIENCIA_SOLAR" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (cx) return cx.id;
  const admin = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

// ─── Listado (panel interno + timeline) ──────────────────────────────────────

export async function listByProject(projectId: string): Promise<SatisfactionSurvey[]> {
  return prisma.satisfactionSurvey.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}
