/**
 * Bandejas de WhatsApp: las conversaciones de un número de Voltia, para usarlas
 * desde el módulo de cada área (no desde Administración, que solo configura).
 *
 * - **Experiencia Solar**: el número general (el que tiene `uso =
 *   EXPERIENCIA_SOLAR`). Lo usa cualquiera que entre a Experiencia Solar. Si no
 *   hay ninguno conectado, cae al número de las variables de entorno, que es con
 *   el que se probó la conexión.
 * - **Ventas** (próxima parte): el número de cada asesor (`uso = VENTAS`,
 *   responsable = el asesor).
 *
 * Cada conversación se une al cliente por el teléfono cargado en el proyecto o,
 * si escribe desde otro número, por la asociación hecha a mano
 * (`whatsapp_conversaciones.projectId`). Ver docs/manual/15-whatsapp.md.
 */

import { InteractionChannel, InteractionDirection } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { decryptSecret } from "../email/crypto.js";
import {
  type Cuenta,
  enviarPlantilla,
  enviarTexto,
  listarPlantillas,
  normalizarTelefono,
} from "./api.service.js";
import { faltantesParaEnviar, whatsappConfig } from "./config.js";

const VENTANA_MS = 24 * 60 * 60 * 1000;

export const USOS_NUMERO = ["EXPERIENCIA_SOLAR", "VENTAS"] as const;
export type UsoNumero = (typeof USOS_NUMERO)[number];

export type Bandeja = {
  /** Por dónde sale y entra. null = no hay número para esta bandeja. */
  cuenta: Cuenta | null;
  /** Como lo muestra Meta ("+598 98 123 456"); null si es el de las variables de entorno. */
  telefono: string | null;
  nombre: string | null;
};

/** La bandeja de Experiencia Solar: el número general, o el del servidor si no hay ninguno conectado. */
export async function bandejaExperienciaSolar(): Promise<Bandeja> {
  const n = await prisma.whatsAppNumero.findFirst({
    where: { uso: "EXPERIENCIA_SOLAR", estado: "CONECTADO" },
    orderBy: { conectadoEn: "desc" },
  });
  if (n) {
    return {
      cuenta: { phoneNumberId: n.phoneNumberId, wabaId: n.wabaId, token: decryptSecret(n.tokenCifrado) },
      telefono: n.telefono,
      nombre: n.nombreVerificado,
    };
  }
  const c = whatsappConfig();
  if (faltantesParaEnviar(c).length > 0) return { cuenta: null, telefono: null, nombre: null };
  return {
    cuenta: { phoneNumberId: c.phoneNumberId, wabaId: c.wabaId, token: c.token },
    telefono: null,
    nombre: null,
  };
}

function exigirCuenta(b: Bandeja): Cuenta {
  if (!b.cuenta) {
    throw badRequest("SIN_NUMERO", "No hay un número de WhatsApp conectado para esta bandeja.");
  }
  return b.cuenta;
}

// ─── Clientes por teléfono ───────────────────────────────────────────────────

export type ClienteDeConversacion = {
  projectId: string;
  codigo: string;
  nombre: string;
  /** true si se asoció a mano (escribe desde un número que no está en la ficha). */
  aMano: boolean;
};

/** Un campo de teléfono puede traer más de uno ("099 123 456 / 098 765 432"). */
export function telefonosDe(campo: string | null | undefined): string[] {
  if (!campo) return [];
  return campo
    .split(/[\/,;]|\s+y\s+|\s+o\s+/i)
    .map((t) => normalizarTelefono(t))
    .filter((t) => t.length >= 10);
}

/** Teléfono → proyecto. Si dos proyectos comparten teléfono, gana el más nuevo. */
async function proyectosPorTelefono(): Promise<Map<string, Omit<ClienteDeConversacion, "aMano">>> {
  const proyectos = await prisma.project.findMany({
    where: { deletedAt: null, clientPhone: { not: null } },
    select: { id: true, code: true, clientName: true, clientPhone: true },
    orderBy: { createdAt: "asc" },
  });
  const mapa = new Map<string, Omit<ClienteDeConversacion, "aMano">>();
  for (const p of proyectos) {
    for (const t of telefonosDe(p.clientPhone)) mapa.set(t, { projectId: p.id, codigo: p.code, nombre: p.clientName });
  }
  return mapa;
}

// ─── Conversaciones ──────────────────────────────────────────────────────────

type FilaUltimo = {
  telefono: string;
  texto: string | null;
  tipo: string;
  direccion: string;
  ocurridoEn: Date;
  total: bigint;
  ultimoEntranteEn: Date | null;
};

/** El último mensaje de cada conversación del número, con la hora del último del cliente. */
async function ultimosPorTelefono(phoneNumberId: string, telefonos?: string[]): Promise<FilaUltimo[]> {
  const filas = await prisma.$queryRaw<FilaUltimo[]>`
    SELECT DISTINCT ON (m.telefono)
      m.telefono, m.texto, m.tipo, m.direccion, m."ocurridoEn",
      count(*) OVER (PARTITION BY m.telefono) AS total,
      max(m."ocurridoEn") FILTER (WHERE m.direccion = 'ENTRANTE') OVER (PARTITION BY m.telefono) AS "ultimoEntranteEn"
    FROM whatsapp_mensajes m
    WHERE m."phoneNumberId" = ${phoneNumberId}
    ORDER BY m.telefono, m."ocurridoEn" DESC
  `;
  return telefonos ? filas.filter((f) => telefonos.includes(f.telefono)) : filas;
}

/**
 * Sin contestar: el último mensaje de la conversación es del cliente y nadie
 * marcó "no hace falta contestar" después. Un mensaje escrito desde el celular
 * (coexistencia) cuenta como respuesta.
 */
export function estaSinContestar(
  f: { direccion: string; ultimoEntranteEn: Date | null },
  resueltoHasta: Date | null | undefined,
): boolean {
  if (f.direccion !== "ENTRANTE" || !f.ultimoEntranteEn) return false;
  return !resueltoHasta || f.ultimoEntranteEn > resueltoHasta;
}

export function estaNoLeida(ultimoEntranteEn: Date | null, leidoHasta: Date | null | undefined): boolean {
  if (!ultimoEntranteEn) return false;
  return !leidoHasta || ultimoEntranteEn > leidoHasta;
}

export async function listarConversaciones(bandeja: Bandeja) {
  if (!bandeja.cuenta) return [];
  const phoneNumberId = bandeja.cuenta.phoneNumberId;
  const [ultimos, estados, porTelefono] = await Promise.all([
    ultimosPorTelefono(phoneNumberId),
    prisma.whatsAppConversacion.findMany({
      where: { phoneNumberId },
      include: { project: { select: { id: true, code: true, clientName: true, deletedAt: true } } },
    }),
    proyectosPorTelefono(),
  ]);
  const estadoDe = new Map(estados.map((e) => [e.telefono, e]));
  const ahora = Date.now();
  return ultimos
    .map((u) => {
      const e = estadoDe.get(u.telefono);
      const aMano = e?.project && !e.project.deletedAt ? e.project : null;
      const auto = porTelefono.get(u.telefono);
      const cliente: ClienteDeConversacion | null = aMano
        ? { projectId: aMano.id, codigo: aMano.code, nombre: aMano.clientName, aMano: true }
        : auto
          ? { ...auto, aMano: false }
          : null;
      return {
        telefono: u.telefono,
        ultimoTexto: u.texto ?? `[${u.tipo}]`,
        ultimaDireccion: u.direccion,
        ultimoEn: u.ocurridoEn.toISOString(),
        total: Number(u.total),
        ventanaAbierta: !!u.ultimoEntranteEn && ahora - u.ultimoEntranteEn.getTime() < VENTANA_MS,
        noLeida: estaNoLeida(u.ultimoEntranteEn, e?.leidoHasta),
        sinContestar: estaSinContestar(u, e?.resueltoHasta),
        cliente,
      };
    })
    .sort((a, b) => (a.ultimoEn < b.ultimoEn ? 1 : -1));
}

export async function mensajesDe(bandeja: Bandeja, telefono: string, limite = 500) {
  if (!bandeja.cuenta) return [];
  const filas = await prisma.whatsAppMensaje.findMany({
    where: { telefono: normalizarTelefono(telefono), phoneNumberId: bandeja.cuenta.phoneNumberId },
    orderBy: { ocurridoEn: "desc" },
    take: limite,
    include: { enviadoPor: { select: { name: true } } },
  });
  return filas.reverse().map((m) => ({
    id: m.id,
    waMessageId: m.waMessageId,
    direccion: m.direccion,
    tipo: m.tipo,
    texto: m.texto,
    plantilla: m.plantilla,
    estado: m.estado,
    estadoEn: m.estadoEn?.toISOString() ?? null,
    error: m.errorDetalle ? `${m.errorCodigo ?? ""} ${m.errorDetalle}`.trim() : null,
    enviadoPor: m.enviadoPor?.name ?? null,
    origen: m.origen,
    ocurridoEn: m.ocurridoEn.toISOString(),
  }));
}

async function ultimoEntrante(phoneNumberId: string, telefono: string): Promise<Date | null> {
  const m = await prisma.whatsAppMensaje.findFirst({
    where: { phoneNumberId, telefono, direccion: "ENTRANTE" },
    orderBy: { ocurridoEn: "desc" },
    select: { ocurridoEn: true },
  });
  return m?.ocurridoEn ?? null;
}

/** Abrirla en la bandeja la marca leída para todos (la bandeja es compartida). */
export async function marcarLeida(bandeja: Bandeja, telefono: string, userId: string) {
  const { phoneNumberId } = exigirCuenta(bandeja);
  const tel = normalizarTelefono(telefono);
  const hasta = (await ultimoEntrante(phoneNumberId, tel)) ?? new Date();
  await prisma.whatsAppConversacion.upsert({
    where: { phoneNumberId_telefono: { phoneNumberId, telefono: tel } },
    create: { phoneNumberId, telefono: tel, leidoHasta: hasta, leidoPorId: userId },
    update: { leidoHasta: hasta, leidoPorId: userId },
  });
}

/** "No hace falta contestar": apaga la alerta hasta que el cliente vuelva a escribir. */
export async function marcarResuelta(bandeja: Bandeja, telefono: string, userId: string) {
  const { phoneNumberId } = exigirCuenta(bandeja);
  const tel = normalizarTelefono(telefono);
  const hasta = await ultimoEntrante(phoneNumberId, tel);
  if (!hasta) return;
  await prisma.whatsAppConversacion.upsert({
    where: { phoneNumberId_telefono: { phoneNumberId, telefono: tel } },
    create: { phoneNumberId, telefono: tel, resueltoHasta: hasta, leidoHasta: hasta, leidoPorId: userId },
    update: { resueltoHasta: hasta, leidoHasta: hasta, leidoPorId: userId },
  });
}

/** Asocia la conversación a un proyecto (o la desasocia con null). */
export async function asociarCliente(bandeja: Bandeja, telefono: string, projectId: string | null) {
  const { phoneNumberId } = exigirCuenta(bandeja);
  const tel = normalizarTelefono(telefono);
  if (projectId) {
    const p = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true } });
    if (!p) throw notFound("PROYECTO_NO_ENCONTRADO", "El proyecto no existe");
  }
  await prisma.whatsAppConversacion.upsert({
    where: { phoneNumberId_telefono: { phoneNumberId, telefono: tel } },
    create: { phoneNumberId, telefono: tel, projectId },
    update: { projectId },
  });
}

/** El cliente de una conversación: el asociado a mano o, si no, el del teléfono. */
export async function clienteDe(bandeja: Bandeja, telefono: string): Promise<ClienteDeConversacion | null> {
  const tel = normalizarTelefono(telefono);
  if (bandeja.cuenta) {
    const e = await prisma.whatsAppConversacion.findUnique({
      where: { phoneNumberId_telefono: { phoneNumberId: bandeja.cuenta.phoneNumberId, telefono: tel } },
      include: { project: { select: { id: true, code: true, clientName: true, deletedAt: true } } },
    });
    if (e?.project && !e.project.deletedAt) {
      return { projectId: e.project.id, codigo: e.project.code, nombre: e.project.clientName, aMano: true };
    }
  }
  const auto = (await proyectosPorTelefono()).get(tel);
  return auto ? { ...auto, aMano: false } : null;
}

// ─── Mandar ──────────────────────────────────────────────────────────────────

export type MandarBody =
  | { tipo: "plantilla"; telefono: string; plantilla: string; idioma: string; variables?: string[] }
  | { tipo: "texto"; telefono: string; texto: string };

/**
 * Manda desde la bandeja y, si la conversación es de un cliente, deja el contacto
 * en su historial: uno por día (el primer mensaje), para que cuente como
 * contacto sin llenar el historial con cada renglón del chat.
 */
export async function mandar(bandeja: Bandeja, body: MandarBody, userId: string) {
  const cuenta = exigirCuenta(bandeja);
  const mensaje =
    body.tipo === "texto"
      ? await enviarTexto({ telefono: body.telefono, texto: body.texto, userId, cuenta })
      : await enviarPlantilla({
          telefono: body.telefono,
          nombre: body.plantilla,
          idioma: body.idioma,
          variables: body.variables,
          userId,
          cuenta,
        });
  const cliente = await clienteDe(bandeja, body.telefono);
  if (cliente) {
    await registrarContactoDelDia(cliente.projectId, mensaje.texto ?? `Plantilla ${mensaje.plantilla ?? ""}`, userId).catch(
      (err) => console.error("[whatsapp] no se pudo registrar el contacto en el historial:", err),
    );
  }
  return mensaje;
}

const PREFIJO_CONTACTO = "WhatsApp desde Voltia PM:";

/** Inicio del día de hoy en Uruguay (UTC-3, sin horario de verano). */
function inicioDelDiaUruguay(ahora = new Date()): Date {
  const uy = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(uy.getUTCFullYear(), uy.getUTCMonth(), uy.getUTCDate(), 3));
}

async function registrarContactoDelDia(projectId: string, texto: string, userId: string) {
  const yaHoy = await prisma.clientInteraction.findFirst({
    where: {
      projectId,
      channel: InteractionChannel.WHATSAPP,
      direction: InteractionDirection.SALIENTE,
      content: { startsWith: PREFIJO_CONTACTO },
      createdAt: { gte: inicioDelDiaUruguay() },
    },
    select: { id: true },
  });
  if (yaHoy) return;
  const { createInteraction } = await import("../clientes/index.js");
  await createInteraction(projectId, InteractionChannel.WHATSAPP, `${PREFIJO_CONTACTO}\n${texto}`, userId, {
    direction: InteractionDirection.SALIENTE,
  });
}

export async function plantillasDe(bandeja: Bandeja) {
  return listarPlantillas(exigirCuenta(bandeja));
}

// ─── Para la ficha del cliente ───────────────────────────────────────────────

/**
 * Lo que la ficha de Experiencia Solar muestra de WhatsApp: los últimos
 * mensajes con el cliente por el número general y si tiene uno sin contestar.
 */
export async function whatsappDeProyecto(bandeja: Bandeja, projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, clientPhone: true },
  });
  if (!p) throw notFound("PROYECTO_NO_ENCONTRADO", "El proyecto no existe");
  const propios = telefonosDe(p.clientPhone);
  if (!bandeja.cuenta) {
    return { hayNumero: false, telefono: propios[0] ?? null, sinContestar: null, noLeida: false, mensajes: [] };
  }
  const phoneNumberId = bandeja.cuenta.phoneNumberId;
  const asociadas = await prisma.whatsAppConversacion.findMany({ where: { phoneNumberId }, select: { telefono: true, projectId: true, leidoHasta: true, resueltoHasta: true } });
  // Los del teléfono de la ficha, salvo que se hayan asociado a mano a otro
  // cliente; más los que se asociaron a mano a este.
  const ajenos = new Set(asociadas.filter((a) => a.projectId && a.projectId !== projectId).map((a) => a.telefono));
  const telefonos = [
    ...new Set([...propios.filter((t) => !ajenos.has(t)), ...asociadas.filter((a) => a.projectId === projectId).map((a) => a.telefono)]),
  ];
  if (telefonos.length === 0) {
    return { hayNumero: true, telefono: null, sinContestar: null, noLeida: false, mensajes: [] };
  }
  const ultimos = await ultimosPorTelefono(phoneNumberId, telefonos);
  const estadoDe = new Map(asociadas.map((a) => [a.telefono, a]));
  // La conversación de referencia: la que tuvo movimiento más reciente.
  const principal = [...ultimos].sort((a, b) => b.ocurridoEn.getTime() - a.ocurridoEn.getTime())[0];
  const telefono = principal?.telefono ?? telefonos[0];
  const pendiente = ultimos.find((u) => estaSinContestar(u, estadoDe.get(u.telefono)?.resueltoHasta));
  const mensajes = principal ? (await mensajesDe(bandeja, telefono, 6)) : [];
  return {
    hayNumero: true,
    telefono,
    sinContestar: pendiente
      ? { telefono: pendiente.telefono, desde: pendiente.ultimoEntranteEn!.toISOString(), texto: pendiente.texto ?? `[${pendiente.tipo}]` }
      : null,
    noLeida: ultimos.some((u) => estaNoLeida(u.ultimoEntranteEn, estadoDe.get(u.telefono)?.leidoHasta)),
    mensajes,
  };
}
