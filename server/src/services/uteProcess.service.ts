import { Prisma, UteStage, UteStatus } from "@prisma/client";

import { diffInDays, startOfUtcDay } from "../utils/dates.js";
import { serializeDate } from "../utils/serialization.js";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type UteActionKey =
  | "consultaSentAt"
  | "caseOpenedAt"
  | "consultaApprovedAt"
  | "solicitudSentAt"
  | "proyectoApprovedAt"
  | "docs1SentAt"
  | "docs1ApprovedAt"
  | "ensayosSentAt"
  | "ensayosApprovedAt"
  | "docs2SentAt"
  | "finalizedAt";

export const UTE_ACTION_KEYS: UteActionKey[] = [
  "consultaSentAt",
  "caseOpenedAt",
  "consultaApprovedAt",
  "solicitudSentAt",
  "proyectoApprovedAt",
  "docs1SentAt",
  "docs1ApprovedAt",
  "ensayosSentAt",
  "ensayosApprovedAt",
  "docs2SentAt",
  "finalizedAt",
];

const OUR_ACTIONS = new Set<UteActionKey>([
  "consultaSentAt",
  "solicitudSentAt",
  "docs1SentAt",
  "ensayosSentAt",
  "docs2SentAt",
]);

export function isOurAction(key: UteActionKey): boolean {
  return OUR_ACTIONS.has(key);
}

// ─── Cálculo de tiempos ─────────────────────────────────────────────────────

export type UteTimes = {
  ourTimeDays: number;
  uteTimeDays: number;
  totalDays: number;
};

type ProcessDates = Pick<
  Prisma.UteProcessGetPayload<{}>,
  UteActionKey | "createdAt"
>;

export function calculateTimes(process: ProcessDates, now: Date = new Date()): UteTimes {
  const actions = UTE_ACTION_KEYS.map((key) => ({
    key,
    type: isOurAction(key) ? ("ours" as const) : ("ute" as const),
    date: process[key] as Date | null,
  }));

  const completed = actions.filter((a): a is { key: UteActionKey; type: "ours" | "ute"; date: Date } => a.date !== null);

  if (completed.length === 0) {
    return { ourTimeDays: 0, uteTimeDays: 0, totalDays: 0 };
  }

  completed.sort((a, b) => a.date.getTime() - b.date.getTime());

  let ourTime = 0;
  let uteTime = 0;

  for (let i = 1; i < completed.length; i++) {
    const prev = completed[i - 1];
    const curr = completed[i];
    const days = Math.max(0, diffInDays(prev.date, curr.date));
    if (curr.type === "ours") ourTime += days;
    else uteTime += days;
  }

  const isClosed = process.finalizedAt !== null;
  if (!isClosed) {
    const last = completed[completed.length - 1];
    const daysUntilToday = Math.max(0, diffInDays(last.date, now));
    if (last.type === "ours") uteTime += daysUntilToday;
    else ourTime += daysUntilToday;
  }

  const totalDays = ourTime + uteTime;

  // Invariante de la spec: total debe ser la suma exacta. Si algún día no
  // cuadrase, el bug estaría en este archivo, no en el caller.
  if (totalDays !== ourTime + uteTime) {
    console.warn(
      `[ute-process] calculateTimes: invariante roto — ours=${ourTime} ute=${uteTime} total=${totalDays}`,
    );
  }

  return { ourTimeDays: ourTime, uteTimeDays: uteTime, totalDays };
}

export function lastActionAt(process: ProcessDates): Date | null {
  let max: Date | null = null;
  for (const key of UTE_ACTION_KEYS) {
    const v = process[key] as Date | null;
    if (v && (!max || v.getTime() > max.getTime())) max = v;
  }
  return max;
}

// ─── Derivación de stage ────────────────────────────────────────────────────

// Prioridad top-down: la primera condición que matchea gana. `RELEVAR` es
// manual y no se deriva de fechas; el caller debe respetarlo (ver
// `deriveStage` docstring).
export function deriveStage(process: ProcessDates): UteStage {
  if (process.finalizedAt) return UteStage.FINALIZADO;
  if (process.docs2SentAt) return UteStage.DOCS_2;
  if (process.ensayosApprovedAt) return UteStage.DOCS_2;
  if (process.ensayosSentAt) return UteStage.ENSAYOS;
  if (process.docs1ApprovedAt) return UteStage.ENSAYOS;
  if (process.docs1SentAt) return UteStage.DOCS_1;
  if (process.proyectoApprovedAt) return UteStage.DOCS_1;
  if (process.solicitudSentAt) return UteStage.SOLICITUD;
  if (process.consultaApprovedAt) return UteStage.SOLICITUD;
  if (process.consultaSentAt) return UteStage.CONSULTA;
  return UteStage.CONSULTA;
}

// ─── Serialización ──────────────────────────────────────────────────────────

type UteProcessRow = Prisma.UteProcessGetPayload<{
  include: {
    project: {
      select: {
        id: true;
        code: true;
        clientName: true;
        locationCity: true;
        notificationPhone: true;
        notificationEmail: true;
        uteCodigoPS: true;
        uteCodigoAS: true;
      };
    };
  };
}>;

export type SerializedUteProcess = {
  id: string;
  projectId: string;
  project: {
    id: string;
    code: string;
    clientName: string;
    locationCity: string;
    notificationPhone: string | null;
    notificationEmail: string | null;
    uteCodigoPS: string | null;
    uteCodigoAS: string | null;
  };
  currentStage: UteStage;
  currentStatus: UteStatus;
  stageManuallySet: boolean;
  caseNumber: string | null;
  notes: string | null;
  dateColors: DateColorsMap;
  consultaSentAt: string | null;
  caseOpenedAt: string | null;
  consultaApprovedAt: string | null;
  solicitudSentAt: string | null;
  proyectoApprovedAt: string | null;
  docs1SentAt: string | null;
  docs1ApprovedAt: string | null;
  ensayosSentAt: string | null;
  ensayosApprovedAt: string | null;
  docs2SentAt: string | null;
  finalizedAt: string | null;
  lastActionAt: string | null;
  totalDays: number;
  ourTimeDays: number;
  uteTimeDays: number;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
};

export function serializeUteProcess(row: UteProcessRow, now: Date = new Date()): SerializedUteProcess {
  const times = calculateTimes(row, now);
  const colorsRaw = row.dateColors as unknown;
  const colorsValidated = validateDateColors(colorsRaw);
  const dateColors: DateColorsMap = colorsValidated.ok ? (colorsValidated.value ?? {}) : {};
  return {
    id: row.id,
    projectId: row.projectId,
    project: {
      id: row.project.id,
      code: row.project.code,
      clientName: row.project.clientName,
      locationCity: row.project.locationCity,
      notificationPhone: row.project.notificationPhone,
      notificationEmail: row.project.notificationEmail,
      uteCodigoPS: row.project.uteCodigoPS,
      uteCodigoAS: row.project.uteCodigoAS,
    },
    currentStage: row.currentStage,
    currentStatus: row.currentStatus,
    stageManuallySet: row.stageManuallySet,
    caseNumber: row.caseNumber,
    notes: row.notes,
    dateColors,
    consultaSentAt: serializeDate(row.consultaSentAt),
    caseOpenedAt: serializeDate(row.caseOpenedAt),
    consultaApprovedAt: serializeDate(row.consultaApprovedAt),
    solicitudSentAt: serializeDate(row.solicitudSentAt),
    proyectoApprovedAt: serializeDate(row.proyectoApprovedAt),
    docs1SentAt: serializeDate(row.docs1SentAt),
    docs1ApprovedAt: serializeDate(row.docs1ApprovedAt),
    ensayosSentAt: serializeDate(row.ensayosSentAt),
    ensayosApprovedAt: serializeDate(row.ensayosApprovedAt),
    docs2SentAt: serializeDate(row.docs2SentAt),
    finalizedAt: serializeDate(row.finalizedAt),
    lastActionAt: serializeDate(lastActionAt(row)),
    totalDays: times.totalDays,
    ourTimeDays: times.ourTimeDays,
    uteTimeDays: times.uteTimeDays,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdById: row.createdById,
  };
}

export const UTE_PROCESS_INCLUDE = {
  project: {
    select: {
      id: true,
      code: true,
      clientName: true,
      locationCity: true,
      notificationPhone: true,
      notificationEmail: true,
      uteCodigoPS: true,
      uteCodigoAS: true,
    },
  },
} satisfies Prisma.UteProcessInclude;

// ─── Validaciones de coherencia sent ≤ approved ─────────────────────────────

export const SENT_APPROVED_PAIRS: Array<{ sent: UteActionKey; approved: UteActionKey; label: string }> = [
  { sent: "consultaSentAt", approved: "consultaApprovedAt", label: "consulta" },
  { sent: "solicitudSentAt", approved: "proyectoApprovedAt", label: "solicitud" },
  { sent: "docs1SentAt", approved: "docs1ApprovedAt", label: "docs 1" },
  { sent: "ensayosSentAt", approved: "ensayosApprovedAt", label: "ensayos" },
  { sent: "docs2SentAt", approved: "finalizedAt", label: "docs 2 → finalización" },
];

export function validateCoherence(
  dates: Partial<Record<UteActionKey, Date | null>>,
): { ok: true } | { ok: false; message: string } {
  for (const pair of SENT_APPROVED_PAIRS) {
    const s = dates[pair.sent];
    const a = dates[pair.approved];
    if (s && a && startOfUtcDay(a).getTime() < startOfUtcDay(s).getTime()) {
      return {
        ok: false,
        message: `La fecha de "${pair.label} aprobada" no puede ser anterior a la de "enviada".`,
      };
    }
  }
  return { ok: true };
}

// ─── Paleta global de colores para celdas de fecha ──────────────────────────

export const UTE_COLOR_PALETTE = [
  "#5DCAA5", // verde (default)
  "#EAB308", // amarillo
  "#EF5B5B", // rojo
  "#378ADD", // azul
  "#6B7790", // gris
  "#A78BFA", // violeta
] as const;

export type UteColorHex = (typeof UTE_COLOR_PALETTE)[number];

export const UTE_DEFAULT_COLOR: UteColorHex = "#5DCAA5";

const COLOR_SET = new Set<string>(UTE_COLOR_PALETTE);
const ACTION_KEY_SET = new Set<string>(UTE_ACTION_KEYS);

export type DateColorsMap = Partial<Record<UteActionKey, UteColorHex>>;

export function validateDateColors(
  value: unknown,
): { ok: true; value: DateColorsMap | null } | { ok: false; message: string } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "dateColors debe ser un objeto plano" };
  }
  const result: DateColorsMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!ACTION_KEY_SET.has(k)) {
      return { ok: false, message: `dateColors: clave "${k}" no es una acción válida` };
    }
    if (typeof v !== "string" || !COLOR_SET.has(v)) {
      return { ok: false, message: `dateColors: color inválido para "${k}" (no está en la paleta)` };
    }
    result[k as UteActionKey] = v as UteColorHex;
  }
  return { ok: true, value: result };
}
