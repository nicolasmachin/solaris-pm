// Servicio del módulo Experiencia de Clientes (Ola 1 / MVP).
//
// El "cliente" es una proyección sobre `Project` (relación 1:1, no hay entidad
// Cliente). Decisiones tomadas (ver EXPERIENCIA_CLIENTES_SPEC.md):
//   - "etapa" = etapa EN CURSO del pipeline operativo (Onboarding / Ingeniería /
//     Operaciones / Habilitación UTE / Postventa), vía getCurrentStage — NO el
//     ProjectStatus macro, que era casi redundante con "estado".
//   - "estado" se deriva de Project.status: ACTIVE/PAUSED → ACTIVO,
//     COMPLETED → FINALIZADO, ARCHIVED → ARCHIVADO, PROSPECT → PROSPECTO.
//   - Cartera por defecto (sin filtro estado) = ACTIVE+PAUSED+COMPLETED.
//     PROSPECT ("en cotización", aún no es cliente) y ARCHIVED (cajón manual que
//     mezcla entregados viejos con caídos) quedan FUERA salvo que se filtren.
//   - departamento = Project.locationProvince.
//   - fecha de entrega = actualEndDate con fallback a plannedEndDate.
//   - trámite UTE en la ficha = último UteProcess no borrado del proyecto.
//
// El listado se filtra en la DB (where) pero la etapa en curso se calcula en
// memoria (getCurrentStage no es expresable en SQL); por eso ordenamos y
// paginamos también en memoria. La cartera es de cientos de proyectos.

import { Prisma, ProjectStatus, InteractionReason, AuditAction, type InteractionChannel, type InteractionDirection, type StageType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { getStageLabel } from "../pipeline-definitions.js";
import { getCurrentStage } from "../project.service.js";
import { decimalToNumber, serializeDate, serializeDateOnly } from "../../utils/serialization.js";
import { getAnclaMantenimiento, proximoMantenimiento } from "../../utils/aniversario.js";
import { lastActionAt } from "../uteProcess.service.js";
import { TRASPASO_LABEL } from "../traspasos/catalogo.js";

export type ClienteEstado = "ACTIVO" | "FINALIZADO" | "ARCHIVADO" | "PROSPECTO";
// "Etapa" del CRM = recorrido del cliente en 3 etapas (E1/E2/E3), derivado de la
// etapa EN CURSO del pipeline operativo. Exponemos AMBOS niveles: el recorrido
// (código + nombres) y la sub-etapa del pipeline en curso. Ver
// EXPERIENCIA_CLIENTES_ROADMAP.md.
export type ClienteRecorrido = "E1" | "E2" | "E3";
export type ClienteSortBy = "nombre" | "fechaEntrega" | "potenciaKwp" | "etapa" | "proximoMantenimiento";
export type SortDir = "asc" | "desc";

// Próximo mantenimiento = próximo aniversario de la puesta en marcha (año 0 =
// postHabilitacionInicioEn, fallback actualUteEnd). null si el cliente aún no
// está habilitado. Se calcula al vuelo, no se persiste.
export type MantenimientoInfo = {
  aniosQueCumple: number; // qué aniversario cumple (1°, 2°, 3°…)
  proximoAniversario: string; // ISO date (YYYY-MM-DD)
  diasRestantes: number; // días desde hoy hasta el aniversario (>= 0)
};

export type EtapaInfo = {
  recorrido: { codigo: ClienteRecorrido; nombreCorto: string; nombreLargo: string };
  pipeline: { stage: string; label: string };
};

// Mapeo pipeline → recorrido. E1 hasta que la obra queda montada (Operaciones
// completada), E2 mientras se gestiona la habilitación UTE, E3 post-habilitación.
const RECORRIDO_BY_STAGE: Record<StageType, ClienteRecorrido> = {
  ONBOARDING: "E1",
  INGENIERIA: "E1",
  OPERACIONES: "E1",
  HABILITACION_UTE: "E2",
  POSTVENTA: "E3",
  // Pipeline expandido a 8 etapas (Traspasos v1): E1 hasta que la obra queda
  // montada, E2 durante la tramitación UTE, E3 post-habilitación.
  PRE_INGENIERIA: "E1",
  REVISION_CAPATAZ: "E1",
  VALIDACION_OPERACIONES: "E1",
  INGENIERIA_FINAL: "E1",
  COMPRAS: "E1",
  EJECUCION_OBRA: "E1",
  TRAMITACION_UTE: "E2",
  POST_HABILITACION: "E3",
  // Paralelas (excluidas de getCurrentStage; no afectan el recorrido derivado).
  SEGUIMIENTO_PREOBRA: "E1",
  SEGUIMIENTO_HABILITACION: "E2",
};

const RECORRIDO_RANK: Record<ClienteRecorrido, number> = { E1: 1, E2: 2, E3: 3 };

const RECORRIDO_NOMBRE_CORTO: Record<ClienteRecorrido, string> = {
  E1: "Pre-obra",
  E2: "Habilitación",
  E3: "Post-Habilitación",
};

const RECORRIDO_NOMBRE_LARGO: Record<ClienteRecorrido, string> = {
  E1: "De la venta a la obra",
  E2: "De la obra a la habilitación",
  E3: "De la habilitación al uso continuo",
};

// estado → conjunto de ProjectStatus que lo componen.
const ESTADO_STATUSES: Record<ClienteEstado, ProjectStatus[]> = {
  ACTIVO: [ProjectStatus.ACTIVE, ProjectStatus.PAUSED],
  FINALIZADO: [ProjectStatus.COMPLETED],
  ARCHIVADO: [ProjectStatus.ARCHIVED],
  PROSPECTO: [ProjectStatus.PROSPECT],
};

// Cartera principal cuando no se filtra por estado: activos + finalizados.
const DEFAULT_STATUSES: ProjectStatus[] = [
  ProjectStatus.ACTIVE,
  ProjectStatus.PAUSED,
  ProjectStatus.COMPLETED,
];

export type ClienteListItem = {
  projectId: string;
  nombre: string;
  mail: string | null;
  telefono: string | null;
  departamento: string | null;
  potenciaKwp: number | null;
  fechaEntrega: string | null; // ISO date (YYYY-MM-DD)
  asesor: { id: string; nombre: string } | null;
  etapa: EtapaInfo | null; // recorrido (E1/E2/E3) + sub-etapa del pipeline en curso
  estado: ClienteEstado;
  ultimoContactoEn: string | null; // ISO datetime de la última interacción de bitácora
  avisoHabilitacionPendiente: boolean; // Regla de Oro: UTE finalizó y CX aún no avisó
  mantenimiento: MantenimientoInfo | null; // próximo aniversario (mantenimiento)
  hasPortalUser: boolean; // ya tiene usuario de portal (Generador) creado/vinculado
};

export type ClienteFiltros = {
  search?: string;
  estado?: ClienteEstado;
  asesorId?: string;
  departamento?: string;
  etapa?: ClienteRecorrido; // recorrido del cliente a filtrar (E1/E2/E3)
  sortBy?: ClienteSortBy;
  sortDir?: SortDir;
};

// ─── Proyección Project → ClienteListItem ────────────────────────────────────

const LIST_SELECT = {
  id: true,
  clientName: true,
  clientEmail: true,
  clientPhone: true,
  locationProvince: true,
  capacityKwp: true,
  actualEndDate: true,
  plannedEndDate: true,
  saleDate: true,
  status: true,
  salesperson: { select: { id: true, name: true } },
  stages: {
    where: { deletedAt: null },
    select: { name: true, status: true, order: true },
  },
  // Seguimientos CX: aviso post-habilitación (Regla de Oro) + último contacto.
  postHabilitacionInicioEn: true,
  actualUteEnd: true,
  avisoHabilitacionEn: true,
  recorridoManual: true,
  clientInteractions: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true },
  },
  // ¿Tiene ya un usuario de portal (Generador)? Vínculo m2m actual (con el user
  // vivo) o el legacy 1-a-1. Se usa para el badge "Con acceso" del listado.
  clientUserId: true,
  _count: { select: { clients: { where: { user: { deletedAt: null } } } } },
} satisfies Prisma.ProjectSelect;

type ProjectListRow = Prisma.ProjectGetPayload<{ select: typeof LIST_SELECT }>;

function estadoFromStatus(status: ProjectStatus): ClienteEstado {
  switch (status) {
    case ProjectStatus.COMPLETED:
      return "FINALIZADO";
    case ProjectStatus.ARCHIVED:
      return "ARCHIVADO";
    case ProjectStatus.PROSPECT:
      return "PROSPECTO";
    case ProjectStatus.ACTIVE:
    case ProjectStatus.PAUSED:
    default:
      return "ACTIVO";
  }
}

function buildEtapa(stages: ProjectListRow["stages"], recorridoManual: string | null): EtapaInfo | null {
  const current = stages && stages.length > 0 ? getCurrentStage(stages) : null;
  const derivado = current ? RECORRIDO_BY_STAGE[current.name] : null;
  // El override manual pisa el derivado (útil para importados sin pipeline).
  const codigo = (["E1", "E2", "E3"].includes(recorridoManual ?? "")
    ? (recorridoManual as ClienteRecorrido)
    : derivado) as ClienteRecorrido | null;
  if (!codigo) return null;
  return {
    recorrido: {
      codigo,
      nombreCorto: RECORRIDO_NOMBRE_CORTO[codigo],
      nombreLargo: RECORRIDO_NOMBRE_LARGO[codigo],
    },
    pipeline: current
      ? { stage: current.name, label: getStageLabel(current.name) }
      : { stage: "MANUAL", label: "Sin pipeline (manual)" },
  };
}

function toListItem(p: ProjectListRow): ClienteListItem {
  return {
    projectId: p.id,
    nombre: p.clientName,
    mail: p.clientEmail,
    telefono: p.clientPhone,
    departamento: p.locationProvince || null,
    potenciaKwp: decimalToNumber(p.capacityKwp),
    fechaEntrega: serializeDateOnly(p.actualEndDate ?? p.plannedEndDate),
    asesor: p.salesperson ? { id: p.salesperson.id, nombre: p.salesperson.name } : null,
    etapa: buildEtapa(p.stages, p.recorridoManual),
    estado: estadoFromStatus(p.status),
    ultimoContactoEn: p.clientInteractions[0] ? serializeDate(p.clientInteractions[0].createdAt) : null,
    avisoHabilitacionPendiente: p.postHabilitacionInicioEn != null && p.avisoHabilitacionEn == null,
    mantenimiento: buildMantenimiento(p),
    hasPortalUser: p._count.clients > 0 || p.clientUserId != null,
  };
}

function buildMantenimiento(p: ProjectListRow): MantenimientoInfo | null {
  const ancla = getAnclaMantenimiento({
    postHabilitacionInicioEn: p.postHabilitacionInicioEn,
    actualUteEnd: p.actualUteEnd,
  });
  if (!ancla) return null;
  const prox = proximoMantenimiento(ancla);
  return {
    aniosQueCumple: prox.aniosQueCumple,
    proximoAniversario: serializeDateOnly(prox.proximoAniversario)!,
    diasRestantes: prox.diasRestantes,
  };
}

function buildWhere(f: ClienteFiltros): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [];

  if (f.search) {
    and.push({
      OR: [
        { clientName: { contains: f.search, mode: "insensitive" } },
        { clientEmail: { contains: f.search, mode: "insensitive" } },
        { clientPhone: { contains: f.search, mode: "insensitive" } },
      ],
    });
  }
  // Sin filtro estado → cartera principal. Con filtro → ese conjunto de status.
  and.push({ status: { in: f.estado ? ESTADO_STATUSES[f.estado] : DEFAULT_STATUSES } });
  if (f.asesorId) and.push({ salespersonId: f.asesorId });
  if (f.departamento) and.push({ locationProvince: f.departamento });

  return { deletedAt: null, AND: and };
}

// Comparador con "nulls al final" independiente de la dirección.
function compareNullable(a: string | number | null, b: string | number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const base = a < b ? -1 : a > b ? 1 : 0;
  return dir * base;
}

function sortItems(items: ClienteListItem[], sortBy: ClienteSortBy, sortDir: SortDir): ClienteListItem[] {
  const dir: 1 | -1 = sortDir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case "potenciaKwp":
        return compareNullable(a.potenciaKwp, b.potenciaKwp, dir);
      case "fechaEntrega":
        return compareNullable(a.fechaEntrega, b.fechaEntrega, dir);
      case "proximoMantenimiento":
        // Ordena por proximidad al aniversario (días restantes). Sin ancla → al final.
        return compareNullable(
          a.mantenimiento?.diasRestantes ?? null,
          b.mantenimiento?.diasRestantes ?? null,
          dir,
        );
      case "etapa":
        return compareNullable(
          a.etapa ? RECORRIDO_RANK[a.etapa.recorrido.codigo] : null,
          b.etapa ? RECORRIDO_RANK[b.etapa.recorrido.codigo] : null,
          dir,
        );
      case "nombre":
      default:
        return dir * a.nombre.localeCompare(b.nombre, "es");
    }
  });
}

// Proyecta, filtra por etapa (en memoria) y ordena. Reutilizado por list/export.
async function projectAndFilter(f: ClienteFiltros): Promise<ClienteListItem[]> {
  const rows = await prisma.project.findMany({ where: buildWhere(f), select: LIST_SELECT });
  let items = rows.map(toListItem);
  if (f.etapa) items = items.filter((i) => i.etapa?.recorrido.codigo === f.etapa);
  return sortItems(items, f.sortBy ?? "nombre", f.sortDir ?? "asc");
}

// ─── Listado + export ────────────────────────────────────────────────────────

export async function listClientes(f: ClienteFiltros, page: number, pageSize: number) {
  const sorted = await projectAndFilter(f);
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  return { items: sorted.slice(start, start + pageSize), total, page, pageSize };
}

export async function listClientesForExport(f: ClienteFiltros): Promise<ClienteListItem[]> {
  return projectAndFilter(f);
}

// Proyección de un solo cliente (fila del listado). Para devolver tras un PATCH
// sin que el front tenga que refetchear todo el listado.
export async function getClienteListItem(projectId: string): Promise<ClienteListItem | null> {
  const p = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: LIST_SELECT });
  return p ? toListItem(p) : null;
}

// ─── Ficha 360 ───────────────────────────────────────────────────────────────

const UTE_FICHA_SELECT = {
  currentStage: true,
  createdAt: true,
  consultaSentAt: true,
  caseOpenedAt: true,
  consultaApprovedAt: true,
  solicitudSentAt: true,
  proyectoApprovedAt: true,
  docs1SentAt: true,
  docs1ApprovedAt: true,
  ensayosSentAt: true,
  ensayosApprovedAt: true,
  docs2SentAt: true,
  finalizedAt: true,
} satisfies Prisma.UteProcessSelect;

const INTERACTION_SELECT = {
  id: true,
  channel: true,
  direction: true,
  reason: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.ClientInteractionSelect;

type InteractionRow = Prisma.ClientInteractionGetPayload<{ select: typeof INTERACTION_SELECT }>;

function serializeInteraction(i: InteractionRow) {
  return {
    id: i.id,
    channel: i.channel,
    direction: i.direction,
    reason: i.reason,
    content: i.content,
    autor: { id: i.author.id, nombre: i.author.name },
    createdAt: serializeDate(i.createdAt),
    updatedAt: serializeDate(i.updatedAt),
  };
}

export async function getClienteFicha(projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      ...LIST_SELECT,
      clientAddress: true,
      uteProcesses: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: UTE_FICHA_SELECT,
      },
      clientInteractions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: INTERACTION_SELECT,
      },
    },
  });

  if (!p) return null;

  const ute = p.uteProcesses[0] ?? null;

  return {
    ...toListItem(p),
    direccion: p.clientAddress ?? null,
    // Fecha de venta (cierre del lead como ganado) — se muestra junto a la de entrega.
    fechaVenta: serializeDateOnly(p.saleDate),
    tramiteUte: ute ? { etapa: ute.currentStage, desde: serializeDateOnly(lastActionAt(ute)) } : null,
    interacciones: p.clientInteractions.map(serializeInteraction),
    proyectoUrl: `/projects/${p.id}`,
  };
}

// ─── Timeline unificado del cliente ──────────────────────────────────────────
// Junta las fuentes de historia del cliente en un solo feed ordenado por fecha
// DESC. Solo lectura. Fuentes:
//   - Ventas: actividades del lead que originó el proyecto (cambios de etapa).
//   - Proyecto: comentarios, avances de etapa del pipeline, documentos generados
//     (contrato/proforma/propuesta) y traspasos entre áreas.
//   - Cliente: interacciones de la ficha (con dirección y motivo).
//   - Ticket: apertura/resolución de reclamos y consultas.

export interface TimelineItem {
  id: string;
  source: "sales" | "project" | "client" | "ticket" | "survey";
  kind: "stage_change" | "comment" | "interaction" | "document" | "handoff" | "ticket" | "survey";
  text: string;
  autor: { id: string; nombre: string } | null;
  createdAt: string; // ISO
  meta?: Record<string, unknown>;
}

export async function getClienteTimeline(projectId: string): Promise<TimelineItem[]> {
  const lead = await prisma.salesLead.findFirst({
    where: { convertedToProjectId: projectId },
    select: { id: true },
  });

  const items: TimelineItem[] = [];

  // 1. Actividades de Ventas (del lead que originó el proyecto).
  if (lead) {
    const acts = await prisma.salesActivity.findMany({
      where: { leadId: lead.id },
      select: {
        id: true, action: true, notes: true, fromStage: true, toStage: true, createdAt: true,
        user: { select: { id: true, name: true } },
      },
    });
    for (const a of acts) {
      const text = a.notes ?? (a.toStage ? `Cambió de etapa a ${a.toStage}` : a.action);
      items.push({
        id: `sa-${a.id}`,
        source: "sales",
        kind: "stage_change",
        text,
        autor: a.user ? { id: a.user.id, nombre: a.user.name } : null,
        createdAt: serializeDate(a.createdAt) ?? "",
        meta: { action: a.action, fromStage: a.fromStage, toStage: a.toStage },
      });
    }
  }

  // 2. Comentarios: del lead + del proyecto (solo de nivel superior, sin
  //    stage/substage/checklist/task).
  const comments = await prisma.comment.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(lead ? [{ leadId: lead.id }] : []),
        { projectId, stageId: null, substageId: null, checklistItemId: null, taskId: null },
      ],
    },
    select: {
      id: true, content: true, leadId: true, createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });
  for (const c of comments) {
    items.push({
      id: `cm-${c.id}`,
      source: c.leadId ? "sales" : "project",
      kind: "comment",
      text: c.content,
      autor: c.author ? { id: c.author.id, nombre: c.author.name } : null,
      createdAt: serializeDate(c.createdAt) ?? "",
    });
  }

  // 3. Interacciones del cliente (de la ficha).
  const interactions = await prisma.clientInteraction.findMany({
    where: { projectId, deletedAt: null },
    select: INTERACTION_SELECT,
  });
  for (const i of interactions) {
    items.push({
      id: `ci-${i.id}`,
      source: "client",
      kind: "interaction",
      text: i.content,
      autor: { id: i.author.id, nombre: i.author.name },
      createdAt: serializeDate(i.createdAt) ?? "",
      meta: { channel: i.channel, direction: i.direction, reason: i.reason },
    });
  }

  // 4. Auditoría del proyecto: avances de etapa del pipeline y documentos
  //    generados/enviados al cliente (contrato, proforma, propuesta). La
  //    `description` de la auditoría ya viene legible en español.
  const audits = await prisma.auditLog.findMany({
    where: {
      projectId,
      action: {
        in: [
          AuditAction.stage_advanced,
          AuditAction.contract_version_published,
          AuditAction.proforma_version_published,
          AuditAction.proposal_v2_version_published,
        ],
      },
    },
    select: {
      id: true, action: true, description: true, timestamp: true,
      user: { select: { id: true, name: true } },
    },
  });
  for (const a of audits) {
    items.push({
      id: `au-${a.id}`,
      source: "project",
      kind: a.action === AuditAction.stage_advanced ? "stage_change" : "document",
      text: a.description,
      autor: a.user ? { id: a.user.id, nombre: a.user.name } : null,
      createdAt: serializeDate(a.timestamp) ?? "",
      meta: { action: a.action },
    });
  }

  // 5. Traspasos entre áreas (handoffs del recorrido interno del cliente).
  const traspasos = await prisma.traspaso.findMany({
    where: { projectId },
    select: {
      id: true, tipo: true, estado: true, notaAlReceptor: true, createdAt: true,
      modalUsuario: { select: { id: true, name: true } },
    },
  });
  for (const t of traspasos) {
    const label = TRASPASO_LABEL[t.tipo];
    const nota = t.notaAlReceptor?.trim();
    items.push({
      id: `tr-${t.id}`,
      source: "project",
      kind: "handoff",
      text: nota ? `Traspaso: ${label} — ${nota}` : `Traspaso: ${label}`,
      autor: t.modalUsuario ? { id: t.modalUsuario.id, nombre: t.modalUsuario.name } : null,
      createdAt: serializeDate(t.createdAt) ?? "",
      meta: { tipo: t.tipo, estado: t.estado },
    });
  }

  // 6. Tickets: apertura y (si corresponde) resolución. `creadoPorId` y
  //    `resueltoPorId` son ids sueltos (sin relación); se resuelven en un lookup.
  const tickets = await prisma.ticket.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true, titulo: true, estado: true, origenCliente: true,
      creadoPorId: true, resueltoPorId: true, createdAt: true, resueltoEn: true,
    },
  });
  if (tickets.length > 0) {
    const uids = new Set<string>();
    for (const t of tickets) {
      uids.add(t.creadoPorId);
      if (t.resueltoPorId) uids.add(t.resueltoPorId);
    }
    const users = await prisma.user.findMany({
      where: { id: { in: [...uids] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    for (const t of tickets) {
      items.push({
        id: `tk-${t.id}`,
        source: "ticket",
        kind: "ticket",
        text: `${t.origenCliente ? "El Generador abrió" : "Se abrió"} un ticket: "${t.titulo}"`,
        autor: { id: t.creadoPorId, nombre: nameById.get(t.creadoPorId) ?? "—" },
        createdAt: serializeDate(t.createdAt) ?? "",
        meta: { estado: t.estado },
      });
      if (t.resueltoEn) {
        items.push({
          id: `tk-${t.id}-res`,
          source: "ticket",
          kind: "ticket",
          text: `Se resolvió el ticket: "${t.titulo}"`,
          autor: t.resueltoPorId
            ? { id: t.resueltoPorId, nombre: nameById.get(t.resueltoPorId) ?? "—" }
            : null,
          createdAt: serializeDate(t.resueltoEn) ?? "",
          meta: { estado: t.estado },
        });
      }
    }
  }

  // 7. Encuestas de satisfacción respondidas (nota + comentario).
  const surveys = await prisma.satisfactionSurvey.findMany({
    where: { projectId, deletedAt: null, estado: "RESPONDIDA" },
    select: {
      id: true, tipo: true, edicion: true, nota: true, comentario: true,
      respondidaEn: true, respondidaPorId: true,
    },
  });
  if (surveys.length > 0) {
    const uids = [...new Set(surveys.map((s) => s.respondidaPorId).filter((x): x is string => !!x))];
    const users = await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, name: true } });
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const tipoLabel: Record<string, string> = { OBRA: "instalación", HABILITACION: "habilitación", ANIVERSARIO: "aniversario" };
    for (const s of surveys) {
      const etiqueta =
        s.tipo === "ANIVERSARIO" && s.edicion > 0
          ? `aniversario (año ${s.edicion})`
          : tipoLabel[s.tipo] ?? s.tipo;
      items.push({
        id: `sv-${s.id}`,
        source: "survey",
        kind: "survey",
        text: `El Generador respondió la encuesta de ${etiqueta}: ${s.nota}/5`,
        autor: s.respondidaPorId
          ? { id: s.respondidaPorId, nombre: nameById.get(s.respondidaPorId) ?? "—" }
          : null,
        createdAt: serializeDate(s.respondidaEn) ?? "",
        meta: { nota: s.nota, comentario: s.comentario, tipo: s.tipo },
      });
    }
  }

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

// ─── Bitácora ────────────────────────────────────────────────────────────────

export async function projectExists(projectId: string): Promise<boolean> {
  const p = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true } });
  return !!p;
}

export async function listInteractions(projectId: string) {
  const rows = await prisma.clientInteraction.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: INTERACTION_SELECT,
  });
  return rows.map(serializeInteraction);
}

export async function createInteraction(
  projectId: string,
  channel: InteractionChannel,
  content: string,
  authorId: string,
  opts?: { direction?: InteractionDirection; reason?: InteractionReason },
) {
  const row = await prisma.clientInteraction.create({
    data: {
      projectId,
      channel,
      content,
      authorId,
      direction: opts?.direction ?? null,
      reason: opts?.reason ?? null,
    },
    select: INTERACTION_SELECT,
  });
  // Regla de Oro: si se registra el aviso de habilitación al cliente, se marca
  // en el proyecto para cortar las alertas del cron (idempotente: no repisa).
  if (opts?.reason === InteractionReason.AVISO_HABILITACION) {
    await prisma.project.updateMany({
      where: { id: projectId, avisoHabilitacionEn: null },
      data: { avisoHabilitacionEn: new Date() },
    });
  }
  return serializeInteraction(row);
}

// Ownership: el autor puede modificar su interacción; ADMIN cualquiera.
export function canModifyInteraction(user: { id: string; role: string }, authorId: string): boolean {
  return user.id === authorId || user.role === "ADMIN";
}

// Interacción activa (no borrada) con lo necesario para ownership + auditoría.
export async function getActiveInteraction(id: string) {
  return prisma.clientInteraction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, projectId: true, content: true, channel: true },
  });
}

export async function updateInteraction(id: string, content: string, channel?: InteractionChannel) {
  const row = await prisma.clientInteraction.update({
    where: { id },
    data: { content, ...(channel ? { channel } : {}) },
    select: INTERACTION_SELECT,
  });
  return serializeInteraction(row);
}

export async function softDeleteInteraction(id: string, userId: string) {
  await prisma.clientInteraction.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: userId },
  });
}

// ─── Export CSV ──────────────────────────────────────────────────────────────

const ESTADO_CSV_LABEL: Record<ClienteEstado, string> = {
  ACTIVO: "Activo",
  FINALIZADO: "Finalizado",
  ARCHIVADO: "Archivado",
  PROSPECTO: "En cotización",
};

const CSV_HEADERS = [
  "Nombre",
  "Estado",
  "Recorrido",
  "Etapa",
  "Asesor",
  "Departamento",
  "Potencia kWp",
  "Fecha entrega",
  "Teléfono",
  "Mail",
];

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV nativo: UTF-8 con BOM (para que Excel respete las tildes) y CRLF.
export function buildClientesCsv(items: ClienteListItem[]): string {
  const rows = items.map((i) => [
    i.nombre,
    ESTADO_CSV_LABEL[i.estado],
    i.etapa ? `${i.etapa.recorrido.codigo} · ${i.etapa.recorrido.nombreLargo}` : "",
    i.etapa ? i.etapa.pipeline.label : "",
    i.asesor?.nombre ?? "",
    i.departamento ?? "",
    i.potenciaKwp ?? "",
    i.fechaEntrega ?? "",
    i.telefono ?? "",
    i.mail ?? "",
  ]);
  const lines = [CSV_HEADERS, ...rows].map((r) => r.map(csvEscape).join(","));
  return "﻿" + lines.join("\r\n");
}
