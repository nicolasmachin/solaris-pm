// Agenda pública de cargadores de autos eléctricos.
//
// El cliente entra a /agendar-cargador (sin login), elige día y franja si vive
// en la zona metropolitana, o deja sus datos para que se le confirme
// disponibilidad si vive fuera. Cada pedido crea:
//   - una ReservaCargador (el registro de lo que pidió),
//   - un lead en Ventas (para que nadie tenga que pasarlo a mano),
//   - en las reservas con día, un evento CARGADOR_EV en el calendario,
//   - un mail de confirmación al cliente y un aviso interno.
//
// Piloto: instala la misma cuadrilla solar los fines de semana. Por eso un día
// se ofrece solo si ese equipo no tiene ya una obra u otro evento ese día.

import {
  AuditAction,
  AuditEntityType,
  EstadoReservaCargador,
  FranjaCargador,
  OrigenLead,
  SettingKey,
  SettingLevel,
  TipoEventoAgenda,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { addDays, parseDateOnly, toDateOnlyString } from "../../utils/dates.js";
import { hoyUruguay } from "../../utils/uruguay.js";
import { createAuditEntry } from "../audit.service.js";
import { crearAgendaEvento, eliminarAgendaEvento } from "../agenda/agenda.service.js";
import { sendEmail } from "../email.service.js";
import { crearLead } from "../sales/leads.service.js";

// ── Configuración ──────────────────────────────────────────────────────────

const franjaConfigSchema = z.object({
  /** Texto que ve el cliente, p. ej. "9 a 13 h". */
  horario: z.string().trim().min(1).max(40),
  /** Instalaciones que entran en la franja. 0 = la franja no se ofrece. */
  cupo: z.number().int().min(0).max(10),
});

export const configSchema = z.object({
  /** Apagada, la página pública dice que por ahora no se toman reservas. */
  activa: z.boolean(),
  /** Días de la semana que se ofrecen (0 = domingo … 6 = sábado). */
  dias: z.array(z.number().int().min(0).max(6)).max(7),
  franjas: z.object({ MANANA: franjaConfigSchema, TARDE: franjaConfigSchema }),
  /** Días mínimos entre hoy y el primer día que se puede reservar. */
  anticipacionDias: z.number().int().min(0).max(60),
  /** Hasta cuántos días para adelante se ofrecen. */
  horizonteDias: z.number().int().min(7).max(180),
  /** Equipo que instala. Sus obras y eventos bloquean el día. Null = cualquier equipo. */
  teamId: z.string().nullable(),
  /** Departamentos que están enteros en la zona (Montevideo). */
  departamentosEnZona: z.array(z.string().trim().min(1)).max(19),
  /** Localidades sueltas de otros departamentos que también son zona. */
  localidadesEnZona: z
    .array(z.object({ departamento: z.string().trim().min(1), localidad: z.string().trim().min(1) }))
    .max(200),
  /** Mails internos que reciben el aviso de cada reserva. */
  avisarA: z.array(z.string().trim().email()).max(10),
});

export type ConfigCargadores = z.infer<typeof configSchema>;

export const CONFIG_DEFAULT: ConfigCargadores = {
  activa: true,
  dias: [6, 0],
  franjas: {
    MANANA: { horario: "9 a 13 h", cupo: 1 },
    TARDE: { horario: "14 a 18 h", cupo: 1 },
  },
  anticipacionDias: 3,
  horizonteDias: 45,
  teamId: null,
  departamentosEnZona: ["Montevideo"],
  localidadesEnZona: [
    ...[
      "Ciudad de la Costa",
      "Paso Carrasco",
      "Barros Blancos",
      "Pando",
      "Las Piedras",
      "La Paz",
      "Progreso",
      "Colón",
      "Joaquín Suárez",
      "Toledo",
      "Salinas",
      "Atlántida",
    ].map((localidad) => ({ departamento: "Canelones", localidad })),
    { departamento: "San José", localidad: "Ciudad del Plata" },
  ],
  avisarA: [],
};

export const DEPARTAMENTOS_UY = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida",
  "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha",
  "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres",
];

export const FRANJA_LABEL: Record<FranjaCargador, string> = {
  MANANA: "Mañana",
  TARDE: "Tarde",
};

const DIA_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "setiembre", "octubre", "noviembre", "diciembre"];

export async function leerConfig(): Promise<ConfigCargadores> {
  const row = await prisma.setting.findFirst({
    where: { key: SettingKey.AGENDA_CARGADORES, level: SettingLevel.SYSTEM },
    select: { value: true },
  });
  if (!row) return CONFIG_DEFAULT;
  try {
    // Mezcla con los defaults: una config guardada antes de sumar un campo sigue valiendo.
    const parsed = configSchema.safeParse({ ...CONFIG_DEFAULT, ...JSON.parse(row.value) });
    return parsed.success ? parsed.data : CONFIG_DEFAULT;
  } catch {
    return CONFIG_DEFAULT;
  }
}

export async function guardarConfig(config: ConfigCargadores, userId: string): Promise<ConfigCargadores> {
  if (config.teamId) {
    const team = await prisma.team.findFirst({ where: { id: config.teamId, deletedAt: null }, select: { id: true } });
    if (!team) throw badRequest("TEAM_NOT_FOUND", "El equipo no existe.");
  }
  const limpia: ConfigCargadores = { ...config, dias: [...new Set(config.dias)].sort() };
  const value = JSON.stringify(limpia);
  const existing = await prisma.setting.findFirst({
    where: { key: SettingKey.AGENDA_CARGADORES, level: SettingLevel.SYSTEM },
    select: { id: true },
  });
  if (existing) {
    await prisma.setting.update({ where: { id: existing.id }, data: { value, updatedById: userId } });
  } else {
    await prisma.setting.create({
      data: { key: SettingKey.AGENDA_CARGADORES, level: SettingLevel.SYSTEM, value, updatedById: userId },
    });
  }
  return limpia;
}

/** Lo que necesita la página pública: sin equipo ni mails internos. */
export function configPublica(c: ConfigCargadores) {
  return {
    activa: c.activa,
    franjas: {
      MANANA: { label: FRANJA_LABEL.MANANA, horario: c.franjas.MANANA.horario },
      TARDE: { label: FRANJA_LABEL.TARDE, horario: c.franjas.TARDE.horario },
    },
    departamentos: DEPARTAMENTOS_UY,
    departamentosEnZona: c.departamentosEnZona,
    localidadesEnZona: c.localidadesEnZona,
  };
}

export function estaEnZona(c: ConfigCargadores, departamento: string, localidad: string): boolean {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  if (c.departamentosEnZona.some((d) => norm(d) === norm(departamento))) return true;
  return c.localidadesEnZona.some(
    (l) => norm(l.departamento) === norm(departamento) && norm(l.localidad) === norm(localidad),
  );
}

// ── Disponibilidad ─────────────────────────────────────────────────────────

export interface DiaDisponible {
  fecha: string;
  franjas: Array<{ franja: FranjaCargador; libres: number }>;
}

/**
 * Días y franjas libres entre hoy + anticipación y hoy + horizonte.
 *
 * Un día no se ofrece si el equipo configurado (o cualquier equipo, si no hay
 * uno elegido) tiene ese día una obra o un evento del calendario que no sea
 * otro cargador: la cuadrilla es la misma que la de las obras solares. Los
 * cargadores ya reservados descuentan cupo de su franja.
 */
export async function calcularDisponibilidad(c: ConfigCargadores): Promise<DiaDisponible[]> {
  if (!c.activa || c.dias.length === 0) return [];
  const franjasActivas = (Object.keys(c.franjas) as FranjaCargador[]).filter((f) => c.franjas[f].cupo > 0);
  if (franjasActivas.length === 0) return [];

  const hoy = parseDateOnly(hoyUruguay().iso);
  const desde = addDays(hoy, c.anticipacionDias);
  const hasta = addDays(hoy, c.horizonteDias);

  const candidatos: Date[] = [];
  for (let d = desde; d <= hasta; d = addDays(d, 1)) {
    if (c.dias.includes(d.getUTCDay())) candidatos.push(d);
  }
  if (candidatos.length === 0) return [];

  const ocupados = await diasOcupadosPorEquipo(c.teamId, desde, hasta);

  const reservas = await prisma.reservaCargador.groupBy({
    by: ["fecha", "franja"],
    where: { estado: EstadoReservaCargador.RESERVADA, fecha: { gte: desde, lte: hasta } },
    _count: { _all: true },
  });
  const usados = new Map<string, number>();
  for (const r of reservas) {
    if (r.fecha && r.franja) usados.set(`${toDateOnlyString(r.fecha)}|${r.franja}`, r._count._all);
  }

  const out: DiaDisponible[] = [];
  for (const d of candidatos) {
    const iso = toDateOnlyString(d)!;
    if (ocupados.has(iso)) continue;
    const franjas = franjasActivas
      .map((franja) => ({ franja, libres: c.franjas[franja].cupo - (usados.get(`${iso}|${franja}`) ?? 0) }))
      .filter((f) => f.libres > 0);
    if (franjas.length > 0) out.push({ fecha: iso, franjas });
  }
  return out;
}

async function diasOcupadosPorEquipo(teamId: string | null, desde: Date, hasta: Date): Promise<Set<string>> {
  const ocupados = new Set<string>();

  const segmentos = await prisma.installationSegment.findMany({
    where: {
      startDate: { lte: hasta },
      endDate: { gte: desde },
      schedule: {
        deletedAt: null,
        project: { deletedAt: null },
        ...(teamId ? { teamId } : {}),
      },
    },
    select: { startDate: true, endDate: true },
  });
  for (const s of segmentos) {
    const ini = s.startDate < desde ? desde : s.startDate;
    const fin = s.endDate > hasta ? hasta : s.endDate;
    for (let d = ini; d <= fin; d = addDays(d, 1)) ocupados.add(toDateOnlyString(d)!);
  }

  const dias = await prisma.agendaEventoDia.findMany({
    where: {
      fecha: { gte: desde, lte: hasta },
      evento: {
        deletedAt: null,
        tipo: { not: TipoEventoAgenda.CARGADOR_EV },
        ...(teamId ? { teamId } : {}),
      },
    },
    select: { fecha: true },
  });
  for (const d of dias) ocupados.add(toDateOnlyString(d.fecha)!);

  return ocupados;
}

// ── Reserva ────────────────────────────────────────────────────────────────

export const reservaInputSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  celular: z.string().trim().min(6).max(30),
  email: z.string().trim().email().max(160),
  direccion: z.string().trim().min(3).max(200),
  departamento: z.string().trim().min(2).max(60),
  localidad: z.string().trim().min(2).max(80),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  franja: z.nativeEnum(FranjaCargador).nullish(),
  tieneCargador: z.boolean(),
  modeloCargador: z.string().trim().max(120).nullish(),
  modeloAuto: z.string().trim().max(120).nullish(),
  notas: z.string().trim().max(1000).nullish(),
  origen: z.nativeEnum(OrigenLead).nullish(),
});

export type ReservaInput = z.infer<typeof reservaInputSchema>;

export async function crearReserva(input: ReservaInput, ip: string | null) {
  const c = await leerConfig();
  if (!c.activa) {
    throw badRequest("AGENDA_CERRADA", "Por ahora no estamos tomando reservas desde la web. Escribinos y te ayudamos.");
  }
  if (!DEPARTAMENTOS_UY.includes(input.departamento)) {
    throw badRequest("DEPARTAMENTO_INVALIDO", "Elegí un departamento de la lista.");
  }

  const enZona = estaEnZona(c, input.departamento, input.localidad);

  // En la zona se reserva día y franja. Sin día elegido (fuera de la zona, o
  // porque no quedaban lugares libres) el pedido entra como "a confirmar".
  const reservaDia = enZona && !!input.fecha && !!input.franja;
  const fecha: Date | null = reservaDia ? parseDateOnly(input.fecha!) : null;
  const franja: FranjaCargador | null = reservaDia ? input.franja! : null;

  const datos = {
    nombre: input.nombre,
    celular: input.celular,
    email: input.email.toLowerCase(),
    direccion: input.direccion,
    departamento: input.departamento,
    localidad: input.localidad,
    enZona,
    tieneCargador: input.tieneCargador,
    modeloCargador: input.modeloCargador?.trim() || null,
    modeloAuto: input.modeloAuto?.trim() || null,
    notas: input.notas?.trim() || null,
    ip,
  };

  // El lock por día evita que dos personas reserven a la vez el último lugar.
  // La disponibilidad se vuelve a calcular adentro: lo que vio el cliente al
  // abrir la página puede haber cambiado.
  const reserva = fecha
    ? await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cargador:${input.fecha}`}))`;
        const libres = await calcularDisponibilidad(c);
        const dia = libres.find((d) => d.fecha === input.fecha);
        if (!dia || !dia.franjas.some((f) => f.franja === franja)) {
          throw conflict("FRANJA_OCUPADA", "Ese horario se acaba de ocupar. Elegí otro, por favor.");
        }
        return tx.reservaCargador.create({
          data: { ...datos, estado: EstadoReservaCargador.RESERVADA, fecha, franja },
        });
      })
    : await prisma.reservaCargador.create({ data: { ...datos, estado: EstadoReservaCargador.A_CONFIRMAR } });

  // Lo que sigue ya no puede deshacer la reserva: si algo falla se registra y
  // la reserva queda igual (el equipo la ve en la lista de reservas).
  const sistema = await usuarioSistema();
  let leadId: string | null = null;
  let agendaEventoId: string | null = null;

  if (sistema) {
    try {
      const lead = await crearLead({
        data: {
          clientName: datos.nombre,
          clientPhone: datos.celular,
          clientEmail: datos.email,
          address: `${datos.direccion}, ${datos.localidad}, ${datos.departamento}`,
          notes: notasLead(reserva),
          origen: input.origen ?? OrigenLead.OTRO,
          origenDetalle: input.origen && input.origen !== OrigenLead.OTRO ? null : "Agenda web de cargadores",
        },
        actor: sistema,
        metadata: { fuente: "agenda_cargadores", reservaId: reserva.id },
      });
      leadId = lead.id;
    } catch (err) {
      console.error("[cargadores] no se pudo crear el lead:", err);
    }

    if (reserva.fecha && reserva.franja) {
      try {
        const evento = await crearAgendaEvento({
          tipo: TipoEventoAgenda.CARGADOR_EV,
          titulo: `Cargador · ${datos.nombre} · ${FRANJA_LABEL[reserva.franja]}`,
          fechas: [reserva.fecha],
          teamId: c.teamId,
          notas: notasEvento(reserva, c),
          userId: sistema.id,
        });
        agendaEventoId = evento.id;
      } catch (err) {
        console.error("[cargadores] no se pudo crear el evento:", err);
      }
    }
  } else {
    console.error("[cargadores] no hay usuario de sistema: la reserva queda sin lead ni evento.");
  }

  const final = await prisma.reservaCargador.update({
    where: { id: reserva.id },
    data: { leadId, agendaEventoId },
  });

  void enviarMails(final, c).catch((err) => console.error("[cargadores] fallo al mandar mails:", err));

  return final;
}

type Reserva = Awaited<ReturnType<typeof prisma.reservaCargador.create>>;

let sistemaCache: { id: string; name: string } | null | undefined;
/** Primer ADMIN: firma lo que hace la página pública, igual que los avisos automáticos. */
async function usuarioSistema(): Promise<{ id: string; name: string } | null> {
  if (sistemaCache !== undefined) return sistemaCache;
  const u = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  sistemaCache = u ?? null;
  return sistemaCache;
}

export function describirDia(fecha: Date): string {
  return `${DIA_SEMANA[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`;
}

function cuandoTexto(r: Reserva, c: ConfigCargadores): string {
  if (!r.fecha || !r.franja) return r.enZona ? "a confirmar (no quedaban lugares libres)" : "a confirmar (fuera de la zona metropolitana)";
  return `${describirDia(r.fecha)}, ${FRANJA_LABEL[r.franja].toLowerCase()} (${c.franjas[r.franja].horario})`;
}

function cargadorTexto(r: Reserva): string {
  return r.tieneCargador
    ? `Ya tiene el cargador${r.modeloCargador ? ` (${r.modeloCargador})` : ""}`
    : "No tiene cargador: hay que cotizarlo";
}

function notasLead(r: Reserva): string {
  return [
    "Instalación de cargador de auto eléctrico — pedido desde la agenda web.",
    r.estado === EstadoReservaCargador.RESERVADA && r.fecha && r.franja
      ? `Reservó: ${describirDia(r.fecha)}, ${FRANJA_LABEL[r.franja].toLowerCase()}.`
      : r.enZona
        ? "No quedaban lugares libres en la agenda: hay que confirmarle la fecha."
        : "Fuera de la zona metropolitana: hay que confirmarle disponibilidad.",
    cargadorTexto(r) + ".",
    r.modeloAuto ? `Auto: ${r.modeloAuto}.` : null,
    r.notas ? `Comentario del cliente: ${r.notas}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function notasEvento(r: Reserva, c: ConfigCargadores): string {
  return [
    `Horario: ${r.franja ? c.franjas[r.franja].horario : "-"}`,
    `Dirección: ${r.direccion}, ${r.localidad}, ${r.departamento}`,
    `Celular: ${r.celular}`,
    cargadorTexto(r),
    r.modeloAuto ? `Auto: ${r.modeloAuto}` : null,
    r.notas ? `Comentario: ${r.notas}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Mails ──────────────────────────────────────────────────────────────────

const AZUL = "#1a3fd4";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function plantilla(cuerpo: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f6fa;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fa;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="background:${AZUL};padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">VOLTIA</span>
        </td></tr>
        <tr><td style="padding:28px;color:#1f2937;font-size:14px;line-height:1.6;">${cuerpo}</td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;">
          Voltia · Energía solar y movilidad eléctrica · voltia.com.uy
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function mailCliente(r: Reserva, c: ConfigCargadores): { subject: string; html: string } {
  const nombre = esc(r.nombre.split(" ")[0] ?? r.nombre);
  if (r.estado === EstadoReservaCargador.RESERVADA) {
    return {
      subject: "Reservaste la instalación de tu cargador",
      html: plantilla(`
          <p style="margin:0 0 14px;">Hola ${nombre},</p>
          <p style="margin:0 0 14px;">Recibimos tu reserva para instalar el cargador de tu auto eléctrico:</p>
          <p style="margin:0 0 14px;padding:12px 16px;background:#f3f6fa;border-radius:8px;">
            <strong>${esc(cuandoTexto(r, c))}</strong><br>${esc(`${r.direccion}, ${r.localidad}`)}
          </p>
          <p style="margin:0 0 14px;">Antes de la visita te vamos a escribir para confirmar los detalles de la instalación.</p>
          <p style="margin:0 0 4px;color:#4b5563;">Si necesitás cambiar el día, respondé este correo.</p>
          <p style="margin:18px 0 0;">Saludos,<br>Equipo de Voltia</p>`),
    };
  }
  return {
    subject: "Recibimos tu pedido de instalación de cargador",
    html: plantilla(`
          <p style="margin:0 0 14px;">Hola ${nombre},</p>
          <p style="margin:0 0 14px;">Recibimos tu pedido para instalar el cargador de tu auto eléctrico en
            <strong>${esc(`${r.localidad}, ${r.departamento}`)}</strong>.</p>
          <p style="margin:0 0 14px;">${r.enZona ? "Vamos a revisar la agenda" : "Como queda fuera de la zona metropolitana, vamos a revisar la agenda"} y te escribimos
            en los próximos días para coordinar una fecha.</p>
          <p style="margin:0 0 4px;color:#4b5563;">Cualquier consulta, respondé este correo.</p>
          <p style="margin:18px 0 0;">Saludos,<br>Equipo de Voltia</p>`),
  };
}

async function enviarMails(r: Reserva, c: ConfigCargadores): Promise<void> {
  const cliente = mailCliente(r, c);
  await sendEmail({ to: r.email, subject: cliente.subject, html: cliente.html, type: "client_facing" });

  if (c.avisarA.length === 0) return;
  const filas = [
    ["Cuándo", cuandoTexto(r, c)],
    ["Cliente", r.nombre],
    ["Celular", r.celular],
    ["Mail", r.email],
    ["Dirección", `${r.direccion}, ${r.localidad}, ${r.departamento}`],
    ["Cargador", cargadorTexto(r)],
    ["Auto", r.modeloAuto ?? "-"],
    ["Comentario", r.notas ?? "-"],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">${k}</td><td>${esc(v)}</td></tr>`)
    .join("");
  await sendEmail({
    to: c.avisarA,
    subject:
      r.estado === EstadoReservaCargador.RESERVADA
        ? `Cargador reservado: ${r.nombre} · ${r.fecha ? describirDia(r.fecha) : ""}`
        : `Cargador a confirmar${r.enZona ? "" : " (fuera de zona)"}: ${r.nombre} · ${r.localidad}`,
    html: plantilla(`<table style="font-size:14px;">${filas}</table>`),
  });
}

// ── Gestión interna ────────────────────────────────────────────────────────

export async function listarReservas(filtro: { incluirCanceladas?: boolean }) {
  const reservas = await prisma.reservaCargador.findMany({
    where: filtro.incluirCanceladas ? {} : { estado: { not: EstadoReservaCargador.CANCELADA } },
    orderBy: [{ fecha: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 300,
  });
  const leads = await prisma.salesLead.findMany({
    where: { id: { in: reservas.map((r) => r.leadId).filter((x): x is string => !!x) } },
    select: { id: true, code: true },
  });
  const codigo = new Map(leads.map((l) => [l.id, l.code]));
  return reservas.map((r) => ({
    ...r,
    fecha: toDateOnlyString(r.fecha),
    leadCode: r.leadId ? (codigo.get(r.leadId) ?? null) : null,
  }));
}

export async function cancelarReserva(id: string, user: { id: string }) {
  const r = await prisma.reservaCargador.findUnique({ where: { id } });
  if (!r) throw notFound("RESERVA_NOT_FOUND", "La reserva no existe.");
  if (r.estado === EstadoReservaCargador.CANCELADA) return r;

  if (r.agendaEventoId) {
    // Libera el día en el calendario. Si alguien ya lo había borrado, no importa.
    await eliminarAgendaEvento({ id: r.agendaEventoId, userId: user.id }).catch(() => undefined);
  }
  const actualizada = await prisma.reservaCargador.update({
    where: { id },
    data: { estado: EstadoReservaCargador.CANCELADA, canceladaEn: new Date() },
  });
  if (r.leadId) {
    await createAuditEntry({
      entityType: AuditEntityType.lead,
      entityId: r.leadId,
      action: AuditAction.updated,
      userId: user.id,
      description: `Se canceló la reserva de instalación de cargador${r.fecha ? ` del ${describirDia(r.fecha)}` : ""}`,
    }).catch(() => undefined);
  }
  return actualizada;
}
