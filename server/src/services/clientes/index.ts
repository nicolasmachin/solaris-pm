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

import { Prisma, ProjectStatus, type InteractionChannel, type StageType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { getStageLabel } from "../pipeline-definitions.js";
import { getCurrentStage } from "../project.service.js";
import { decimalToNumber, serializeDate, serializeDateOnly } from "../../utils/serialization.js";
import { lastActionAt } from "../uteProcess.service.js";

export type ClienteEstado = "ACTIVO" | "FINALIZADO" | "ARCHIVADO" | "PROSPECTO";
// "Etapa" del CRM = recorrido del cliente en 3 etapas (E1/E2/E3), derivado de la
// etapa EN CURSO del pipeline operativo. Exponemos AMBOS niveles: el recorrido
// (código + nombres) y la sub-etapa del pipeline en curso. Ver
// EXPERIENCIA_CLIENTES_ROADMAP.md.
export type ClienteRecorrido = "E1" | "E2" | "E3";
export type ClienteSortBy = "nombre" | "fechaEntrega" | "potenciaKwp" | "etapa";
export type SortDir = "asc" | "desc";

export type EtapaInfo = {
  recorrido: { codigo: ClienteRecorrido; nombreCorto: string; nombreLargo: string };
  pipeline: { stage: StageType; label: string };
};

// Mapeo pipeline → recorrido. E1 hasta que la obra queda montada (Operaciones
// completada), E2 mientras se gestiona la habilitación UTE, E3 post-habilitación.
const RECORRIDO_BY_STAGE: Record<StageType, ClienteRecorrido> = {
  ONBOARDING: "E1",
  INGENIERIA: "E1",
  OPERACIONES: "E1",
  HABILITACION_UTE: "E2",
  POSTVENTA: "E3",
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
  status: true,
  salesperson: { select: { id: true, name: true } },
  stages: {
    where: { deletedAt: null },
    select: { name: true, status: true, order: true },
  },
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

function buildEtapa(stages: ProjectListRow["stages"]): EtapaInfo | null {
  if (!stages || stages.length === 0) return null;
  const current = getCurrentStage(stages);
  if (!current) return null;
  // El recorrido se deriva 100% de la etapa en curso del pipeline. La
  // habilitación UTE finalizada ya avanza el pipeline a POSTVENTA (→ E3) de
  // forma automática, así que no hace falta forzarlo desde el trámite.
  const codigo: ClienteRecorrido = RECORRIDO_BY_STAGE[current.name];
  return {
    recorrido: {
      codigo,
      nombreCorto: RECORRIDO_NOMBRE_CORTO[codigo],
      nombreLargo: RECORRIDO_NOMBRE_LARGO[codigo],
    },
    pipeline: { stage: current.name, label: getStageLabel(current.name) },
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
    etapa: buildEtapa(p.stages),
    estado: estadoFromStatus(p.status),
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
    tramiteUte: ute ? { etapa: ute.currentStage, desde: serializeDateOnly(lastActionAt(ute)) } : null,
    interacciones: p.clientInteractions.map(serializeInteraction),
    proyectoUrl: `/projects/${p.id}`,
  };
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
) {
  const row = await prisma.clientInteraction.create({
    data: { projectId, channel, content, authorId },
    select: INTERACTION_SELECT,
  });
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
