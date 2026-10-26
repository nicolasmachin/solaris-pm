// Licencias del personal: contingente anual, saldo, pedidos y aprobación.
//
// El saldo de licencia anual de una persona es:
//   generados  = suma de sus contingentes (uno por año, lo carga RRHH)
//   tomados    = días de sus licencias ANUAL aprobadas
//   pedidos    = días de sus licencias ANUAL todavía sin responder
//   disponibles = generados − tomados − pedidos
// Lo pedido se descuenta ya, para que no se pida dos veces lo mismo.
//
// Los días de una licencia se proponen contando lunes a viernes sin feriados
// (utils/business-days.ts) y RRHH los puede corregir: el número que manda es
// el guardado. El contingente sugerido sigue la regla general de la licencia
// anual (20 días, y desde el 5.º año de antigüedad un día más cada 4 años);
// es una sugerencia que RRHH confirma, no un cálculo legal cerrado.
//
// Solo el personal en relación de dependencia tiene licencias.

import {
  AuditAction,
  AuditEntityType,
  LicenciaEstado,
  LicenciaTipo,
  NotificationType,
  Prisma,
  VinculoLaboral,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { esFeriado } from "../../utils/business-days.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { hoyUruguay } from "../../utils/uruguay.js";
import { createAuditEntry } from "../audit.service.js";
import { createNotification } from "../notification.service.js";
import { asegurarLegajo, usuariosGestores, type RrhhUser } from "./rrhh.service.js";

export const LICENCIA_LABEL: Record<LicenciaTipo, string> = {
  ANUAL: "Licencia anual",
  ENFERMEDAD: "Enfermedad",
  ESTUDIO: "Estudio",
  PATERNIDAD: "Paternidad",
  MATERNIDAD: "Maternidad",
  DUELO: "Duelo",
  MATRIMONIO: "Matrimonio",
  DONACION_SANGRE: "Donación de sangre",
  SIN_GOCE: "Sin goce de sueldo",
  OTRA: "Otra",
};

export const DIAS_BASE_LICENCIA = 20;

// ─── Fechas ─────────────────────────────────────────────────────────────────

function aFecha(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw badRequest("FECHA_INVALIDA", "Fecha inválida (AAAA-MM-DD)");
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDia(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Días de lunes a viernes, sin feriados, entre dos fechas (las dos incluidas). */
export function contarDiasHabiles(desde: Date, hasta: Date) {
  let n = 0;
  for (let d = new Date(desde); d <= hasta; d = new Date(d.getTime() + 86_400_000)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !esFeriado(d)) n++;
  }
  return n;
}

/**
 * Contingente sugerido para los días generados en `anio`: 20 días por año
 * completo trabajado, proporcional si entró ese año, y desde el 5.º año de
 * antigüedad un día más cada 4 años (5 → +1, 9 → +2, 13 → +3).
 */
export function contingenteSugerido(fechaIngreso: Date | null, anio: number) {
  if (!fechaIngreso) return DIAS_BASE_LICENCIA;
  const finDeAnio = new Date(Date.UTC(anio, 11, 31));
  if (fechaIngreso > finDeAnio) return 0;
  if (fechaIngreso.getUTCFullYear() === anio) {
    const meses = 12 - fechaIngreso.getUTCMonth();
    return Math.round((DIAS_BASE_LICENCIA * meses) / 12);
  }
  // Años de antigüedad al cerrar `anio`.
  const antiguedad = anio - fechaIngreso.getUTCFullYear();
  const extra = antiguedad >= 5 ? Math.floor((antiguedad - 1) / 4) : 0;
  return DIAS_BASE_LICENCIA + extra;
}

// ─── Serialización y saldo ──────────────────────────────────────────────────

const licenciaSelect = {
  id: true,
  tipo: true,
  desde: true,
  hasta: true,
  dias: true,
  nota: true,
  estado: true,
  motivoRechazo: true,
  createdAt: true,
  resueltaAt: true,
  solicitadaPor: { select: { id: true, name: true } },
  resueltaPor: { select: { name: true } },
} satisfies Prisma.LicenciaSelect;

type LicenciaRow = Prisma.LicenciaGetPayload<{ select: typeof licenciaSelect }>;

function serializarLicencia(l: LicenciaRow) {
  return {
    id: l.id,
    tipo: l.tipo,
    tipoLabel: LICENCIA_LABEL[l.tipo],
    desde: isoDia(l.desde),
    hasta: isoDia(l.hasta),
    dias: l.dias,
    nota: l.nota,
    estado: l.estado,
    motivoRechazo: l.motivoRechazo,
    createdAt: l.createdAt.toISOString(),
    resueltaAt: l.resueltaAt?.toISOString() ?? null,
    solicitadaPor: l.solicitadaPor.name,
    solicitadaPorUserId: l.solicitadaPor.id,
    resueltaPor: l.resueltaPor?.name ?? null,
  };
}

export type Saldo = { generados: number; tomados: number; pedidos: number; disponibles: number };

export function calcularSaldo(
  contingentes: Array<{ dias: number }>,
  licencias: Array<{ tipo: LicenciaTipo; estado: LicenciaEstado; dias: number }>,
): Saldo {
  const generados = contingentes.reduce((a, c) => a + c.dias, 0);
  const anuales = licencias.filter((l) => l.tipo === LicenciaTipo.ANUAL);
  const tomados = anuales.filter((l) => l.estado === LicenciaEstado.APROBADA).reduce((a, l) => a + l.dias, 0);
  const pedidos = anuales.filter((l) => l.estado === LicenciaEstado.SOLICITADA).reduce((a, l) => a + l.dias, 0);
  return { generados, tomados, pedidos, disponibles: generados - tomados - pedidos };
}

/** Todo lo de licencias de un legajo: contingentes, saldo y licencias (las más nuevas arriba). */
export async function licenciasDeLegajo(legajoId: string) {
  const [legajo, contingentes, licencias] = await Promise.all([
    prisma.legajo.findUnique({ where: { id: legajoId }, select: { fechaIngreso: true, vinculo: true } }),
    prisma.licenciaContingente.findMany({ where: { legajoId }, orderBy: { anio: "desc" } }),
    prisma.licencia.findMany({ where: { legajoId }, orderBy: { desde: "desc" }, select: licenciaSelect }),
  ]);
  const anioActual = hoyUruguay().anio;
  return {
    aplica: legajo?.vinculo === VinculoLaboral.DEPENDIENTE,
    saldo: calcularSaldo(contingentes, licencias),
    contingentes: contingentes.map((c) => ({ id: c.id, anio: c.anio, dias: c.dias, nota: c.nota })),
    // Para el año que se está generando y el anterior (que es el que se goza ahora).
    sugeridos: [anioActual - 1, anioActual].map((anio) => ({
      anio,
      dias: contingenteSugerido(legajo?.fechaIngreso ?? null, anio),
    })),
    licencias: licencias.map(serializarLicencia),
    tipos: Object.values(LicenciaTipo).map((t) => ({ tipo: t, label: LICENCIA_LABEL[t] })),
  };
}

// ─── La persona ─────────────────────────────────────────────────────────────

type DatosLicencia = { tipo: LicenciaTipo; desde: string; hasta: string; nota?: string | null; dias?: number };

function validarRango(datos: DatosLicencia) {
  const desde = aFecha(datos.desde);
  const hasta = aFecha(datos.hasta);
  if (hasta < desde) throw badRequest("RANGO_INVALIDO", "La fecha de vuelta es anterior a la de salida");
  const dias = datos.dias ?? contarDiasHabiles(desde, hasta);
  if (dias < 0 || dias > 366) throw badRequest("DIAS_INVALIDOS", "Cantidad de días inválida");
  return { desde, hasta, dias };
}

export async function misLicencias(user: RrhhUser) {
  const legajo = await asegurarLegajo(user.id);
  return licenciasDeLegajo(legajo.id);
}

/** La persona pide una licencia: queda SOLICITADA y se avisa a RRHH. */
export async function solicitarLicencia(user: RrhhUser, datos: DatosLicencia) {
  const legajo = await asegurarLegajo(user.id);
  if (legajo.vinculo !== VinculoLaboral.DEPENDIENTE) {
    throw forbidden("Las licencias son del personal en relación de dependencia");
  }
  const { desde, hasta } = validarRango(datos);
  // La persona no elige los días: se cuentan solos y RRHH los ajusta.
  const dias = contarDiasHabiles(desde, hasta);
  const l = await prisma.licencia.create({
    data: {
      legajoId: legajo.id,
      tipo: datos.tipo,
      desde,
      hasta,
      dias,
      nota: datos.nota?.trim() || null,
      solicitadaPorId: user.id,
    },
    select: licenciaSelect,
  });
  const autor = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  for (const g of await usuariosGestores()) {
    if (g.id === user.id) continue;
    await createNotification({
      userId: g.id,
      type: NotificationType.legajo_documento,
      title: `${autor?.name ?? "Alguien"} pidió licencia`,
      message: `${LICENCIA_LABEL[l.tipo]}: ${dias} días, del ${fmt(desde)} al ${fmt(hasta)}.`,
      link: `/rrhh/legajos/${user.id}`,
    }).catch(() => undefined);
  }
  return serializarLicencia(l);
}

/** La persona retira un pedido que todavía no se respondió. */
export async function cancelarMiLicencia(user: RrhhUser, id: string) {
  const legajo = await asegurarLegajo(user.id);
  const l = await prisma.licencia.findFirst({ where: { id, legajoId: legajo.id }, select: { estado: true } });
  if (!l) throw notFound("LICENCIA_NOT_FOUND", "Licencia no encontrada");
  if (l.estado !== LicenciaEstado.SOLICITADA) {
    throw forbidden("Una licencia ya respondida la cambia administración");
  }
  await prisma.licencia.update({ where: { id }, data: { estado: LicenciaEstado.CANCELADA } });
}

function fmt(d: Date) {
  return isoDia(d).split("-").reverse().join("/");
}

// ─── RRHH ───────────────────────────────────────────────────────────────────

async function auditar(legajoId: string, userId: string, action: AuditAction, description: string) {
  await createAuditEntry({ entityType: AuditEntityType.legajo, entityId: legajoId, userId, action, description });
}

/** RRHH carga una licencia ya acordada (o ya tomada): entra aprobada. */
export async function registrarLicencia(userId: string, datos: DatosLicencia, gestor: RrhhUser) {
  const legajo = await asegurarLegajo(userId);
  const { desde, hasta, dias } = validarRango(datos);
  const l = await prisma.licencia.create({
    data: {
      legajoId: legajo.id,
      tipo: datos.tipo,
      desde,
      hasta,
      dias,
      nota: datos.nota?.trim() || null,
      estado: LicenciaEstado.APROBADA,
      solicitadaPorId: gestor.id,
      resueltaPorId: gestor.id,
      resueltaAt: new Date(),
    },
    select: licenciaSelect,
  });
  await auditar(legajo.id, gestor.id, AuditAction.created, `Registró ${LICENCIA_LABEL[l.tipo].toLowerCase()} (${dias} días)`);
  return serializarLicencia(l);
}

async function findLicenciaOrThrow(id: string) {
  const l = await prisma.licencia.findUnique({
    where: { id },
    select: { id: true, legajoId: true, estado: true, tipo: true, legajo: { select: { userId: true } } },
  });
  if (!l) throw notFound("LICENCIA_NOT_FOUND", "Licencia no encontrada");
  return l;
}

/** Aprobar o rechazar un pedido. Al aprobar se pueden corregir los días que cuenta. */
export async function resolverLicencia(
  id: string,
  decision: { aprobar: boolean; motivo?: string | null; dias?: number },
  gestor: RrhhUser,
) {
  const actual = await findLicenciaOrThrow(id);
  if (actual.estado !== LicenciaEstado.SOLICITADA) throw badRequest("YA_RESUELTA", "Esa licencia ya se respondió");
  if (!decision.aprobar && !decision.motivo?.trim()) {
    throw badRequest("MOTIVO_REQUERIDO", "Decí por qué no se aprueba");
  }
  const l = await prisma.licencia.update({
    where: { id },
    data: {
      estado: decision.aprobar ? LicenciaEstado.APROBADA : LicenciaEstado.RECHAZADA,
      motivoRechazo: decision.aprobar ? null : decision.motivo!.trim(),
      ...(decision.aprobar && decision.dias !== undefined ? { dias: decision.dias } : {}),
      resueltaPorId: gestor.id,
      resueltaAt: new Date(),
    },
    select: licenciaSelect,
  });
  await createNotification({
    userId: actual.legajo.userId,
    type: NotificationType.legajo_documento,
    title: decision.aprobar ? "Tu licencia está aprobada" : "Tu pedido de licencia no se aprobó",
    message: decision.aprobar
      ? `Del ${fmt(l.desde)} al ${fmt(l.hasta)} (${l.dias} días).`
      : `Motivo: ${l.motivoRechazo}`,
    link: "/mi-legajo",
  }).catch(() => undefined);
  await auditar(actual.legajoId, gestor.id, AuditAction.status_changed, `${decision.aprobar ? "Aprobó" : "Rechazó"} un pedido de licencia`);
  return serializarLicencia(l);
}

/** Corregir fechas, días o nota de una licencia (también una ya aprobada). */
export async function editarLicencia(id: string, datos: Partial<DatosLicencia>, gestor: RrhhUser) {
  const actual = await findLicenciaOrThrow(id);
  const data: Prisma.LicenciaUpdateInput = {};
  if (datos.tipo) data.tipo = datos.tipo;
  if (datos.desde) data.desde = aFecha(datos.desde);
  if (datos.hasta) data.hasta = aFecha(datos.hasta);
  if (datos.dias !== undefined) data.dias = datos.dias;
  if (datos.nota !== undefined) data.nota = datos.nota?.trim() || null;
  const l = await prisma.licencia.update({ where: { id }, data, select: licenciaSelect });
  if (l.hasta < l.desde) throw badRequest("RANGO_INVALIDO", "La fecha de vuelta es anterior a la de salida");
  await auditar(actual.legajoId, gestor.id, AuditAction.updated, "Corrigió una licencia");
  return serializarLicencia(l);
}

/** Anular: no se borra, queda CANCELADA y deja de contar. */
export async function anularLicencia(id: string, gestor: RrhhUser) {
  const actual = await findLicenciaOrThrow(id);
  await prisma.licencia.update({ where: { id }, data: { estado: LicenciaEstado.CANCELADA } });
  await auditar(actual.legajoId, gestor.id, AuditAction.status_changed, "Anuló una licencia");
}

/** Fija los días generados de un año (crea o reemplaza). */
export async function guardarContingente(
  userId: string,
  datos: { anio: number; dias: number; nota?: string | null },
  gestor: RrhhUser,
) {
  const legajo = await asegurarLegajo(userId);
  const c = await prisma.licenciaContingente.upsert({
    where: { legajoId_anio: { legajoId: legajo.id, anio: datos.anio } },
    create: { legajoId: legajo.id, anio: datos.anio, dias: datos.dias, nota: datos.nota?.trim() || null },
    update: { dias: datos.dias, nota: datos.nota?.trim() || null },
  });
  await auditar(legajo.id, gestor.id, AuditAction.updated, `Fijó ${datos.dias} días de licencia generados en ${datos.anio}`);
  return { id: c.id, anio: c.anio, dias: c.dias, nota: c.nota };
}

export async function borrarContingente(id: string, gestor: RrhhUser) {
  const c = await prisma.licenciaContingente.findUnique({ where: { id }, select: { legajoId: true, anio: true } });
  if (!c) throw notFound("CONTINGENTE_NOT_FOUND", "No encontrado");
  await prisma.licenciaContingente.delete({ where: { id } });
  await auditar(c.legajoId, gestor.id, AuditAction.deleted, `Quitó el contingente de licencia de ${c.anio}`);
}

/**
 * Tablero general: saldo de cada persona en relación de dependencia, pedidos
 * sin responder y quién está de licencia hoy o sale en los próximos 30 días.
 */
export async function tableroLicencias() {
  const hoy = new Date(`${hoyUruguay().iso}T00:00:00.000Z`);
  const en30 = new Date(hoy.getTime() + 30 * 86_400_000);
  const legajos = await prisma.legajo.findMany({
    where: { vinculo: VinculoLaboral.DEPENDIENTE, fechaEgreso: null, user: { deletedAt: null } },
    select: {
      userId: true,
      user: { select: { name: true } },
      contingentes: { select: { dias: true } },
      licencias: { select: { ...licenciaSelect, legajoId: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  const personas = legajos.map((l) => ({
    userId: l.userId,
    nombre: l.user.name,
    saldo: calcularSaldo(l.contingentes, l.licencias),
  }));
  const conNombre = legajos.flatMap((l) =>
    l.licencias.map((x) => ({ ...serializarLicencia(x), userId: l.userId, nombre: l.user.name, raw: x })),
  );
  const sinResponder = conNombre.filter((x) => x.estado === LicenciaEstado.SOLICITADA);
  const proximas = conNombre.filter(
    (x) => x.estado === LicenciaEstado.APROBADA && x.raw.hasta >= hoy && x.raw.desde <= en30,
  );
  const sinRaw = <T extends { raw: unknown }>(arr: T[]) => arr.map(({ raw: _raw, ...rest }) => rest);
  return {
    personas,
    sinResponder: sinRaw(sinResponder),
    proximas: sinRaw(proximas).sort((a, b) => a.desde.localeCompare(b.desde)),
  };
}
