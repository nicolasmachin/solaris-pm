/**
 * Bandejas de WhatsApp: las conversaciones de un número de Voltia, para usarlas
 * desde el módulo de cada área (no desde Administración, que solo configura).
 *
 * - **Experiencia Solar**: el número general (el que tiene `uso =
 *   EXPERIENCIA_SOLAR`). Si no hay ninguno conectado, cae al número de las
 *   variables de entorno, que es con el que se probó la conexión.
 * - **Ventas**: el número de cada asesor (`uso = VENTAS`, responsable = el
 *   asesor).
 *
 * Cada número lo ve y lo usa solo su responsable; el admin, cualquiera
 * (decisión de Nicolás del 15-nov-2026). Un número sin responsable lo usa
 * cualquiera con acceso al módulo.
 *
 * En Experiencia Solar cada conversación se une al cliente (proyecto) y en Ventas
 * al lead: por el teléfono cargado o, si escribe desde otro número, por la
 * asociación hecha a mano (`whatsapp_conversaciones.projectId` / `leadId`).
 * Ver docs/manual/15-whatsapp.md.
 */

import { promises as fsp } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { LIMITE_ENVIO, aNotaDeVoz, comprimir, tipoDeArchivo, type Archivo } from "./compresion.service.js";
import { bajarArchivo, mediaDe } from "./media.service.js";
import { getStoredFilePath } from "../file-storage.service.js";
import { InteractionChannel, InteractionDirection } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { decryptSecret } from "../email/crypto.js";
import {
  type Cuenta,
  enviarPlantilla,
  enviarArchivo,
  enviarTexto,
  listarPlantillas,
  normalizarTelefono,
} from "./api.service.js";
import { faltantesParaEnviar, whatsappConfig } from "./config.js";
import { programarSugerenciaPasos } from "../clientes/sugerir-pasos-whatsapp.service.js";

const VENTANA_MS = 24 * 60 * 60 * 1000;

/**
 * DIRECCION: el número de trabajo de la Dirección. No tiene bandeja en Voltia PM:
 * se lee y se contesta desde el chat de Claude (herramientas whatsapp_* del
 * conector, `secretario.service.ts`). Lo ve solo su responsable.
 */
export const USOS_NUMERO = ["EXPERIENCIA_SOLAR", "VENTAS", "DIRECCION"] as const;
export type UsoNumero = (typeof USOS_NUMERO)[number];

export type Bandeja = {
  /** De qué área es: define si las conversaciones se unen a clientes o a leads. */
  area: UsoNumero;
  /** Por dónde sale y entra. null = no hay número para esta bandeja. */
  cuenta: Cuenta | null;
  /** Como lo muestra Meta ("+598 98 123 456"); null si es el de las variables de entorno. */
  telefono: string | null;
  nombre: string | null;
  /** Quién lo usa. null = cualquiera con acceso al módulo. */
  responsable: { id: string; nombre: string } | null;
};

/** Ver y usar un número: su responsable o el admin; sin responsable, cualquiera del módulo. */
export function puedeUsarBandeja(b: Bandeja, user: { id: string; role: string }): boolean {
  return !b.responsable || b.responsable.id === user.id || user.role === "ADMIN";
}

/**
 * Abrir un chat lo marca leído solo si lo abre quien atiende el número: el
 * admin mirando el de otro no le apaga los no leídos.
 */
export function marcaLeida(b: Bandeja, user: { id: string }): boolean {
  return !b.responsable || b.responsable.id === user.id;
}

const SIN_NUMERO = { cuenta: null, telefono: null, nombre: null, responsable: null };

/** La bandeja de Experiencia Solar: el número general, o el del servidor si no hay ninguno conectado. */
export async function bandejaExperienciaSolar(): Promise<Bandeja> {
  const n = await prisma.whatsAppNumero.findFirst({
    where: { uso: "EXPERIENCIA_SOLAR", estado: "CONECTADO" },
    orderBy: { conectadoEn: "desc" },
    include: { responsable: { select: { id: true, name: true } } },
  });
  if (n) {
    return {
      area: "EXPERIENCIA_SOLAR",
      cuenta: { phoneNumberId: n.phoneNumberId, wabaId: n.wabaId, token: decryptSecret(n.tokenCifrado) },
      telefono: n.telefono,
      nombre: n.nombreVerificado,
      responsable: n.responsable ? { id: n.responsable.id, nombre: n.responsable.name } : null,
    };
  }
  const c = whatsappConfig();
  if (faltantesParaEnviar(c).length > 0) return { area: "EXPERIENCIA_SOLAR", ...SIN_NUMERO };
  return {
    area: "EXPERIENCIA_SOLAR",
    cuenta: { phoneNumberId: c.phoneNumberId, wabaId: c.wabaId, token: c.token },
    telefono: null,
    nombre: null,
    responsable: null,
  };
}

/**
 * La bandeja de Ventas de un asesor: su número (`uso = VENTAS`, responsable = él).
 * Sin número conectado no hay bandeja: no cae al de las variables de entorno,
 * que es el general.
 */
export async function bandejaVentas(asesorId: string): Promise<Bandeja> {
  const n = await prisma.whatsAppNumero.findFirst({
    where: { uso: "VENTAS", responsableId: asesorId, estado: "CONECTADO" },
    orderBy: { conectadoEn: "desc" },
    include: { responsable: { select: { id: true, name: true } } },
  });
  if (!n) return { area: "VENTAS", ...SIN_NUMERO };
  return {
    area: "VENTAS",
    cuenta: { phoneNumberId: n.phoneNumberId, wabaId: n.wabaId, token: decryptSecret(n.tokenCifrado) },
    telefono: n.telefono,
    nombre: n.nombreVerificado,
    responsable: n.responsable ? { id: n.responsable.id, nombre: n.responsable.name } : null,
  };
}

/** La bandeja de un número cualquiera (por su phoneNumberId), con su uso como área. */
export async function bandejaDeNumero(phoneNumberId: string): Promise<Bandeja> {
  const n = await prisma.whatsAppNumero.findUnique({
    where: { phoneNumberId },
    include: { responsable: { select: { id: true, name: true } } },
  });
  if (!n) throw notFound("NUMERO_NO_ENCONTRADO", "El número no existe");
  return {
    area: (n.uso as UsoNumero | null) ?? "DIRECCION",
    cuenta: n.estado === "CONECTADO" ? { phoneNumberId: n.phoneNumberId, wabaId: n.wabaId, token: decryptSecret(n.tokenCifrado) } : null,
    telefono: n.telefono,
    nombre: n.nombreVerificado,
    responsable: n.responsable ? { id: n.responsable.id, nombre: n.responsable.name } : null,
  };
}

/** Los asesores que tienen un número de Ventas conectado (para que el admin elija cuál usar). */
export async function asesoresConNumero() {
  const numeros = await prisma.whatsAppNumero.findMany({
    where: { uso: "VENTAS", estado: "CONECTADO", responsableId: { not: null } },
    select: { telefono: true, responsable: { select: { id: true, name: true } } },
    orderBy: { conectadoEn: "asc" },
  });
  return numeros.filter((n) => n.responsable).map((n) => ({ id: n.responsable!.id, nombre: n.responsable!.name, telefono: n.telefono }));
}

function exigirCuenta(b: Bandeja): Cuenta {
  if (!b.cuenta) {
    throw badRequest("SIN_NUMERO", "No hay un número de WhatsApp conectado para esta bandeja.");
  }
  return b.cuenta;
}

// ─── Clientes por teléfono ───────────────────────────────────────────────────

/** El cliente (Experiencia Solar: `projectId`) o el lead (Ventas: `leadId`) de una conversación. */
export type ClienteDeConversacion = {
  projectId?: string;
  leadId?: string;
  /** CRM: el contacto (persona) de la conversación, tenga o no lead o cliente. */
  contactoId?: string;
  /** Un usuario de Voltia: la conversación es interna. */
  usuarioId?: string;
  /** Interna (un usuario de Voltia): no cuenta como sin contestar. */
  interno?: boolean;
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

/** Teléfono → lead. Si dos leads comparten teléfono, gana el más nuevo. */
async function leadsPorTelefono(): Promise<Map<string, Omit<ClienteDeConversacion, "aMano">>> {
  const leads = await prisma.salesLead.findMany({
    where: { deletedAt: null, clientPhone: { not: null } },
    select: { id: true, code: true, clientName: true, clientPhone: true },
    orderBy: { createdAt: "asc" },
  });
  const mapa = new Map<string, Omit<ClienteDeConversacion, "aMano">>();
  for (const l of leads) {
    for (const t of telefonosDe(l.clientPhone)) mapa.set(t, { leadId: l.id, codigo: l.code, nombre: l.clientName });
  }
  return mapa;
}

/**
 * Teléfono → contacto del CRM y, por él, su lead más nuevo (Ventas) o su
 * proyecto más nuevo (Experiencia Solar). El nombre que se muestra es el de la
 * persona; el código, el del lead o proyecto (o la empresa, si no tiene).
 */
async function contactosPorTelefono(area: UsoNumero): Promise<Map<string, Omit<ClienteDeConversacion, "aMano">>> {
  const contactos = await prisma.contacto.findMany({
    where: { deletedAt: null, telefono: { not: null } },
    select: {
      id: true,
      nombre: true,
      telefono: true,
      empresas: { select: { empresa: { select: { razonSocial: true } } }, orderBy: { principal: "desc" }, take: 1 },
      leads: { where: { deletedAt: null }, select: { id: true, code: true }, orderBy: { createdAt: "desc" }, take: 1 },
      projects: { where: { deletedAt: null }, select: { id: true, code: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const mapa = new Map<string, Omit<ClienteDeConversacion, "aMano">>();
  for (const c of contactos) {
    const empresa = c.empresas[0]?.empresa.razonSocial;
    const lead = c.leads[0];
    const proyecto = c.projects[0];
    const base = { contactoId: c.id, nombre: empresa ? `${c.nombre} · ${empresa}` : c.nombre };
    if (area === "VENTAS" && lead) mapa.set(c.telefono!, { ...base, leadId: lead.id, codigo: lead.code });
    else if (area === "EXPERIENCIA_SOLAR" && proyecto) mapa.set(c.telefono!, { ...base, projectId: proyecto.id, codigo: proyecto.code });
    // Dirección: lo más avanzado (el cliente, si ya es; si no, el lead).
    else if (area === "DIRECCION" && proyecto) mapa.set(c.telefono!, { ...base, projectId: proyecto.id, codigo: proyecto.code });
    else if (area === "DIRECCION" && lead) mapa.set(c.telefono!, { ...base, leadId: lead.id, codigo: lead.code });
    else mapa.set(c.telefono!, { ...base, codigo: empresa ? "Contacto de la empresa" : "Contacto" });
  }
  return mapa;
}

/** Teléfono → usuario del equipo de Voltia (el teléfono de su perfil): conversación interna. */
async function usuariosPorTelefono(): Promise<Map<string, Omit<ClienteDeConversacion, "aMano">>> {
  const usuarios = await prisma.user.findMany({
    // Los clientes del portal (rol CLIENT, "Generador") no son equipo.
    where: { deletedAt: null, phone: { not: null }, role: { name: { not: "CLIENT" } } },
    select: { id: true, name: true, phone: true, role: { select: { label: true } } },
  });
  const mapa = new Map<string, Omit<ClienteDeConversacion, "aMano">>();
  for (const u of usuarios) {
    for (const t of telefonosDe(u.phone)) {
      mapa.set(t, { usuarioId: u.id, nombre: u.name, codigo: `Equipo Voltia · ${u.role.label}`, interno: true });
    }
  }
  return mapa;
}

/**
 * Quién es cada teléfono, de menor a mayor prioridad: el teléfono suelto del
 * lead o proyecto, el contacto del CRM y, por encima de todo, un usuario de Voltia.
 */
async function porTelefonoDe(bandeja: Bandeja) {
  const [sueltos, contactos, usuarios] = await Promise.all([
    bandeja.area === "VENTAS"
      ? leadsPorTelefono()
      : bandeja.area === "DIRECCION"
        ? Promise.all([leadsPorTelefono(), proyectosPorTelefono()]).then(([l, p]) => new Map([...l, ...p]))
        : proyectosPorTelefono(),
    contactosPorTelefono(bandeja.area),
    usuariosPorTelefono(),
  ]);
  return new Map([...sueltos, ...contactos, ...usuarios]);
}

const INCLUDE_ASOCIADO = {
  project: { select: { id: true, code: true, clientName: true, deletedAt: true } },
  lead: { select: { id: true, code: true, clientName: true, deletedAt: true } },
  contacto: { select: { id: true, nombre: true, deletedAt: true } },
  usuario: { select: { id: true, name: true, deletedAt: true, role: { select: { label: true } } } },
} as const;

type EstadoConAsociado = {
  project: { id: string; code: string; clientName: string; deletedAt: Date | null } | null;
  lead: { id: string; code: string; clientName: string; deletedAt: Date | null } | null;
  contacto?: { id: string; nombre: string; deletedAt: Date | null } | null;
  usuario?: { id: string; name: string; deletedAt: Date | null; role: { label: string } } | null;
};

/**
 * Lo asociado a mano: un usuario de Voltia, un contacto del CRM o, según el área
 * de la bandeja, un proyecto o un lead.
 */
function asociadoAMano(bandeja: Bandeja, e: EstadoConAsociado | null | undefined): ClienteDeConversacion | null {
  const u = e?.usuario;
  if (u && !u.deletedAt) return { usuarioId: u.id, nombre: u.name, codigo: `Equipo Voltia · ${u.role.label}`, interno: true, aMano: true };
  const c = e?.contacto;
  if (c && !c.deletedAt) return { contactoId: c.id, nombre: c.nombre, codigo: "Contacto", aMano: true };
  if (bandeja.area === "VENTAS") {
    const l = e?.lead;
    return l && !l.deletedAt ? { leadId: l.id, codigo: l.code, nombre: l.clientName, aMano: true } : null;
  }
  const p = e?.project;
  return p && !p.deletedAt ? { projectId: p.id, codigo: p.code, nombre: p.clientName, aMano: true } : null;
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
  /** Estado del último mensaje si es saliente (sent | delivered | read | failed…). */
  estado: string | null;
  /** Entrantes posteriores a lo leído en la bandeja. */
  noLeidos: bigint;
};

/** El último mensaje de cada conversación del número, con la hora del último del cliente. */
async function ultimosPorTelefono(phoneNumberId: string, telefonos?: string[]): Promise<FilaUltimo[]> {
  const filas = await prisma.$queryRaw<FilaUltimo[]>`
    SELECT DISTINCT ON (m.telefono)
      m.telefono, m.texto, m.tipo, m.direccion, m."ocurridoEn", m.estado,
      count(*) OVER (PARTITION BY m.telefono) AS total,
      max(m."ocurridoEn") FILTER (WHERE m.direccion = 'ENTRANTE') OVER (PARTITION BY m.telefono) AS "ultimoEntranteEn",
      count(*) FILTER (
        WHERE m.direccion = 'ENTRANTE' AND (c."leidoHasta" IS NULL OR m."ocurridoEn" > c."leidoHasta")
      ) OVER (PARTITION BY m.telefono) AS "noLeidos"
    FROM whatsapp_mensajes m
    LEFT JOIN whatsapp_conversaciones c
      ON c."phoneNumberId" = m."phoneNumberId" AND c.telefono = m.telefono
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
    prisma.whatsAppConversacion.findMany({ where: { phoneNumberId }, include: INCLUDE_ASOCIADO }),
    porTelefonoDe(bandeja),
  ]);
  const estadoDe = new Map(estados.map((e) => [e.telefono, e]));
  const ahora = Date.now();
  return ultimos
    .map((u) => {
      const e = estadoDe.get(u.telefono);
      const auto = porTelefono.get(u.telefono);
      const cliente: ClienteDeConversacion | null = asociadoAMano(bandeja, e) ?? (auto ? { ...auto, aMano: false } : null);
      return {
        telefono: u.telefono,
        ultimoTexto: u.texto ?? `[${u.tipo}]`,
        ultimaDireccion: u.direccion,
        ultimoEn: u.ocurridoEn.toISOString(),
        ultimoEstado: u.direccion === "SALIENTE" ? u.estado : null,
        total: Number(u.total),
        ventanaAbierta: !!u.ultimoEntranteEn && ahora - u.ultimoEntranteEn.getTime() < VENTANA_MS,
        noLeida: estaNoLeida(u.ultimoEntranteEn, e?.leidoHasta),
        noLeidos: estaNoLeida(u.ultimoEntranteEn, e?.leidoHasta) ? Number(u.noLeidos) : 0,
        // Lo que el asistente le pasa al asesor siempre termina en un mensaje del
        // cliente: queda "sin contestar" solo, con el motivo en `asistente`.
        sinContestar: !cliente?.interno && estaSinContestar(u, e?.resueltoHasta),
        nombrePerfil: e?.nombrePerfil ?? null,
        asistente: e?.asistenteEstado ? { estado: e.asistenteEstado, motivo: e.asistenteMotivo } : null,
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
    // Foto, audio, video o documento: se pide aparte (GET …/mensajes/:id/archivo).
    archivo: (() => {
      const media = mediaDe(m.tipo, m.payload);
      return media
        ? { mime: m.archivoMime ?? media.mime_type ?? null, nombre: media.filename ?? null, error: m.archivoError, transcripcion: m.transcripcion }
        : null;
    })(),
  }));
}

/** El archivo de un mensaje de esta bandeja, bajándolo de Meta si todavía no se bajó. */
export async function archivoDeMensaje(bandeja: Bandeja, mensajeId: string) {
  const { phoneNumberId } = exigirCuenta(bandeja);
  const m = await prisma.whatsAppMensaje.findFirst({ where: { id: mensajeId, phoneNumberId }, select: { id: true, tipo: true, payload: true } });
  if (!m || !mediaDe(m.tipo, m.payload)) throw notFound("ARCHIVO_NO_ENCONTRADO", "El mensaje no tiene archivo");
  const { archivoPath, archivoMime } = await bajarArchivo(m.id).catch((err) => {
    throw notFound("ARCHIVO_NO_DISPONIBLE", `No se pudo traer el archivo de WhatsApp: ${err instanceof Error ? err.message : err}`);
  });
  return { ruta: getStoredFilePath(archivoPath), mime: archivoMime, nombre: mediaDe(m.tipo, m.payload)?.filename ?? null };
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

/**
 * Asocia la conversación a un cliente (o la desasocia con null): un proyecto en
 * Experiencia Solar, un lead en Ventas.
 */
/**
 * Asocia a mano una conversación. `id` es un lead (Ventas) o un proyecto
 * (Experiencia Solar); con prefijo `contacto:` o `usuario:`, un contacto del CRM
 * o un usuario de Voltia. null quita la asociación.
 */
export async function asociarCliente(bandeja: Bandeja, telefono: string, id: string | null) {
  const { phoneNumberId } = exigirCuenta(bandeja);
  const tel = normalizarTelefono(telefono);
  const where = { phoneNumberId_telefono: { phoneNumberId, telefono: tel } };
  const nada = { leadId: null, projectId: null, contactoId: null, usuarioId: null };
  if (id === null) {
    await prisma.whatsAppConversacion.updateMany({ where: { phoneNumberId, telefono: tel }, data: nada });
    return;
  }
  if (id.startsWith("contacto:")) {
    const contactoId = id.slice("contacto:".length);
    const c = await prisma.contacto.findFirst({ where: { id: contactoId, deletedAt: null }, select: { id: true } });
    if (!c) throw notFound("CONTACTO_NO_ENCONTRADO", "El contacto no existe");
    await prisma.whatsAppConversacion.upsert({ where, create: { phoneNumberId, telefono: tel, ...nada, contactoId }, update: { ...nada, contactoId } });
    return;
  }
  if (id.startsWith("usuario:")) {
    const usuarioId = id.slice("usuario:".length);
    const u = await prisma.user.findFirst({ where: { id: usuarioId, deletedAt: null }, select: { id: true } });
    if (!u) throw notFound("USUARIO_NO_ENCONTRADO", "El usuario no existe");
    await prisma.whatsAppConversacion.upsert({ where, create: { phoneNumberId, telefono: tel, ...nada, usuarioId }, update: { ...nada, usuarioId } });
    return;
  }
  if (bandeja.area === "VENTAS") {
    if (id) {
      const l = await prisma.salesLead.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!l) throw notFound("LEAD_NO_ENCONTRADO", "El lead no existe");
    }
    await prisma.whatsAppConversacion.upsert({
      where: { phoneNumberId_telefono: { phoneNumberId, telefono: tel } },
      create: { phoneNumberId, telefono: tel, leadId: id },
      update: { leadId: id, contactoId: null, usuarioId: null },
    });
    return;
  }
  if (id) {
    const p = await prisma.project.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!p) throw notFound("PROYECTO_NO_ENCONTRADO", "El proyecto no existe");
  }
  await prisma.whatsAppConversacion.upsert({
    where: { phoneNumberId_telefono: { phoneNumberId, telefono: tel } },
    create: { phoneNumberId, telefono: tel, projectId: id },
    update: { projectId: id, contactoId: null, usuarioId: null },
  });
}

/** El nombre que tiene puesto en su WhatsApp quien escribe (si ya escribió). */
export async function nombrePerfilDe(bandeja: Bandeja, telefono: string): Promise<string | null> {
  if (!bandeja.cuenta) return null;
  const e = await prisma.whatsAppConversacion.findUnique({
    where: { phoneNumberId_telefono: { phoneNumberId: bandeja.cuenta.phoneNumberId, telefono: normalizarTelefono(telefono) } },
    select: { nombrePerfil: true },
  });
  return e?.nombrePerfil ?? null;
}

/** Qué hizo el asistente de Ventas en esta conversación (y, en prueba, qué habría mandado). */
export async function asistenteDe(bandeja: Bandeja, telefono: string) {
  if (!bandeja.cuenta) return null;
  const e = await prisma.whatsAppConversacion.findUnique({
    where: { phoneNumberId_telefono: { phoneNumberId: bandeja.cuenta.phoneNumberId, telefono: normalizarTelefono(telefono) } },
    select: { asistenteEstado: true, asistenteMotivo: true, asistenteSombra: true, asistenteEn: true },
  });
  if (!e?.asistenteEstado) return null;
  return {
    estado: e.asistenteEstado,
    motivo: e.asistenteMotivo,
    sombra: (e.asistenteSombra as string[] | null) ?? null,
    en: e.asistenteEn?.toISOString() ?? null,
  };
}

/** Para reconocer muchos chats de un número: carga todo una sola vez. */
export async function reconocedor(bandeja: Bandeja): Promise<(telefono: string) => ClienteDeConversacion | null> {
  const [auto, estados] = await Promise.all([
    porTelefonoDe(bandeja),
    bandeja.cuenta
      ? prisma.whatsAppConversacion.findMany({ where: { phoneNumberId: bandeja.cuenta.phoneNumberId }, include: INCLUDE_ASOCIADO })
      : Promise.resolve([]),
  ]);
  const estadoDe = new Map(estados.map((e) => [e.telefono, e]));
  return (telefono) => {
    const tel = normalizarTelefono(telefono);
    const aMano = asociadoAMano(bandeja, estadoDe.get(tel));
    if (aMano) return aMano;
    const a = auto.get(tel);
    return a ? { ...a, aMano: false } : null;
  };
}

/** El cliente de una conversación: el asociado a mano o, si no, el del teléfono. */
export async function clienteDe(bandeja: Bandeja, telefono: string): Promise<ClienteDeConversacion | null> {
  const tel = normalizarTelefono(telefono);
  if (bandeja.cuenta) {
    const e = await prisma.whatsAppConversacion.findUnique({
      where: { phoneNumberId_telefono: { phoneNumberId: bandeja.cuenta.phoneNumberId, telefono: tel } },
      include: INCLUDE_ASOCIADO,
    });
    const aMano = asociadoAMano(bandeja, e);
    if (aMano) return aMano;
  }
  const auto = (await porTelefonoDe(bandeja)).get(tel);
  return auto ? { ...auto, aMano: false } : null;
}

// ─── Mandar ──────────────────────────────────────────────────────────────────

export type MandarBody =
  | { tipo: "plantilla"; telefono: string; plantilla: string; idioma: string; variables?: string[] }
  | { tipo: "texto"; telefono: string; texto: string };

/**
 * Manda desde la bandeja y, si la conversación es de un cliente, actualiza la
 * conversación del día en su ficha (ver `registrarConversacionDelDia`).
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
  await registrarConversacionDelDia(mensaje.phoneNumberId, mensaje.telefono, mensaje.ocurridoEn);
  return mensaje;
}

/**
 * Manda una foto, un audio, un video o un documento desde la bandeja: lo achica,
 * guarda la copia y lo manda. `notaDeVoz` = grabado en Voltia PM (se convierte al
 * formato de nota de voz de WhatsApp).
 */
export async function mandarArchivo(
  bandeja: Bandeja,
  params: { telefono: string; archivo: Archivo; caption?: string | null; notaDeVoz?: boolean },
  userId: string,
) {
  const cuenta = exigirCuenta(bandeja);
  let a = params.notaDeVoz ? await aNotaDeVoz(params.archivo) : await comprimir(params.archivo);
  const tipo = params.notaDeVoz ? "audio" : tipoDeArchivo(a.mime);
  // WhatsApp solo acepta audios OGG/MP3/AAC/AMR/M4A: un audio en otro formato va como nota de voz.
  if (tipo === "audio" && !/^audio\/(ogg|mpeg|mp4|aac|amr)/.test(a.mime)) a = await aNotaDeVoz(a);
  if (a.bytes.length > LIMITE_ENVIO[tipo]) {
    const mb = Math.round(LIMITE_ENVIO[tipo] / 1024 / 1024);
    throw badRequest("ARCHIVO_MUY_GRANDE", `WhatsApp acepta ${tipo === "document" ? "documentos" : tipo === "image" ? "fotos" : tipo === "video" ? "videos" : "audios"} de hasta ${mb} MB.`);
  }
  const relativo = path.posix.join("whatsapp", cuenta.phoneNumberId, `${randomUUID()}.${a.nombre.match(/\.([a-z0-9]{1,6})$/i)?.[1] ?? "bin"}`);
  const absoluto = getStoredFilePath(relativo);
  await fsp.mkdir(path.dirname(absoluto), { recursive: true });
  await fsp.writeFile(absoluto, a.bytes);
  const mensaje = await enviarArchivo({
    telefono: params.telefono,
    tipo,
    bytes: a.bytes,
    mime: a.mime,
    nombre: a.nombre,
    caption: params.caption,
    guardado: relativo,
    userId,
    cuenta,
  }).catch(async (err) => {
    await fsp.rm(absoluto, { force: true }).catch(() => undefined);
    throw err;
  });
  await registrarConversacionDelDia(mensaje.phoneNumberId, mensaje.telefono, mensaje.ocurridoEn);
  return mensaje;
}

// ─── La conversación del día en la ficha ─────────────────────────────────────

/**
 * Cada día que hay WhatsApp con un cliente queda UNA entrada en su ficha (la
 * bitácora de Experiencia Solar, o la actividad del lead en Ventas) con la
 * conversación de ese día: lo que dijo el cliente y lo que le dijimos, se haya
 * escrito desde Voltia PM o desde el celular. Se rearma entera con cada mensaje
 * nuevo, así queda en orden aunque los avisos de Meta lleguen desordenados.
 *
 * Antes solo se registraba lo que salía desde la bandeja: lo que se contestaba
 * desde el celular no dejaba rastro y el cliente figuraba "sin contacto".
 * El historial traído al conectar el número no se registra (llenaría la ficha
 * de días viejos), ni los números de Dirección (no son bandejas del equipo).
 */
const CABECERA_CONVERSACION = "Conversación por WhatsApp con +";
const ACCION_CONVERSACION_LEAD = "Conversación por WhatsApp";
/** Las interacciones se editan con un tope de 2000 caracteres: la entrada no lo pasa. */
const MAX_CONVERSACION = 2000;
const MAX_RENGLON = 300;

/** Inicio del día en Uruguay (UTC-3, sin horario de verano) de un momento dado. */
function inicioDelDiaUruguay(en: Date): Date {
  const uy = new Date(en.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(uy.getUTCFullYear(), uy.getUTCMonth(), uy.getUTCDate(), 3));
}

function horaUruguay(en: Date): string {
  const uy = new Date(en.getTime() - 3 * 60 * 60 * 1000);
  return `${String(uy.getUTCHours()).padStart(2, "0")}:${String(uy.getUTCMinutes()).padStart(2, "0")}`;
}

/** Lo que dice un mensaje, en una línea: audios con su transcripción, archivos por su tipo. */
function textoDeRenglon(m: { tipo: string; texto: string | null; plantilla: string | null; transcripcion: string | null }): string {
  const t = m.texto?.trim();
  if (m.tipo === "template") return `[Plantilla ${m.plantilla ?? ""}]${t ? ` ${t}` : ""}`.trim();
  if (m.tipo === "audio" || m.tipo === "voice") return m.transcripcion ? `[Audio] ${m.transcripcion.trim()}` : "[Audio]";
  const etiqueta: Record<string, string> = {
    image: "[Foto]",
    video: "[Video]",
    document: "[Documento]",
    sticker: "[Sticker]",
    location: "[Ubicación]",
  };
  const e = etiqueta[m.tipo];
  if (e) return t ? `${e} ${t}` : e;
  return t || `[${m.tipo}]`;
}

/** Arma el texto: cabecera + un renglón por mensaje. Si no entra, quedan los últimos. */
export function armarConversacion(
  telefono: string,
  mensajes: { direccion: string; ocurridoEn: Date; quien: string; texto: string }[],
): string {
  const cabecera = `${CABECERA_CONVERSACION}${telefono}`;
  const renglones = mensajes.map((m) => {
    const t = m.texto.replace(/\s+/g, " ").trim();
    const corto = t.length > MAX_RENGLON ? `${t.slice(0, MAX_RENGLON - 1)}…` : t;
    return `${horaUruguay(m.ocurridoEn)} ${m.quien}: ${corto}`;
  });
  let desde = 0;
  const largo = () => cabecera.length + 60 + renglones.slice(desde).reduce((s, r) => s + r.length + 1, 0);
  while (desde < renglones.length - 1 && largo() > MAX_CONVERSACION) desde++;
  const antes = desde > 0 ? [`(${desde} mensaje${desde === 1 ? "" : "s"} antes: completos en el chat)`] : [];
  return [cabecera, ...antes, ...renglones.slice(desde)].join("\n").slice(0, MAX_CONVERSACION);
}

// Dos mensajes del mismo chat que llegan juntos no tienen que crear dos entradas.
const enCurso = new Map<string, Promise<void>>();

/** Para llamar después de guardar cualquier mensaje (entrante, de la bandeja o del celular). */
export function registrarConversacionDelDia(phoneNumberId: string, telefono: string, en: Date): Promise<void> {
  const clave = `${phoneNumberId}:${telefono}:${inicioDelDiaUruguay(en).toISOString()}`;
  const previa = enCurso.get(clave) ?? Promise.resolve();
  const esta = previa
    .catch(() => undefined)
    .then(() => rearmarConversacion(phoneNumberId, telefono, en))
    .catch((err) =>
      console.error("[whatsapp] no se pudo registrar la conversación en la ficha:", err instanceof Error ? err.message : err),
    );
  enCurso.set(clave, esta);
  void esta.finally(() => {
    if (enCurso.get(clave) === esta) enCurso.delete(clave);
  });
  return esta;
}

async function rearmarConversacion(phoneNumberId: string, telefono: string, en: Date) {
  const bandeja = await bandejaDeNumero(phoneNumberId).catch(() => null);
  if (!bandeja || (bandeja.area !== "EXPERIENCIA_SOLAR" && bandeja.area !== "VENTAS")) return;
  const cliente = await clienteDe(bandeja, telefono);
  if (!cliente || cliente.interno) return;
  const projectId = bandeja.area === "EXPERIENCIA_SOLAR" ? cliente.projectId : undefined;
  const leadId = bandeja.area === "VENTAS" ? cliente.leadId : undefined;
  if (!projectId && !leadId) return;

  const desde = inicioDelDiaUruguay(en);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  const mensajes = await prisma.whatsAppMensaje.findMany({
    where: { phoneNumberId, telefono, ocurridoEn: { gte: desde, lt: hasta }, origen: { not: "HISTORIAL" } },
    orderBy: { ocurridoEn: "asc" },
    select: {
      direccion: true,
      ocurridoEn: true,
      tipo: true,
      texto: true,
      plantilla: true,
      transcripcion: true,
      enviadoPor: { select: { id: true, name: true } },
    },
  });
  if (mensajes.length === 0) return;

  const nuestro = (m: (typeof mensajes)[number]) =>
    m.enviadoPor?.name ?? bandeja.responsable?.nombre ?? "Voltia";
  const contenido = armarConversacion(
    telefono,
    mensajes.map((m) => ({
      direccion: m.direccion,
      ocurridoEn: m.ocurridoEn,
      quien: m.direccion === "SALIENTE" ? nuestro(m) : "Cliente",
      texto: textoDeRenglon(m),
    })),
  );
  const cabecera = `${CABECERA_CONVERSACION}${telefono}`;
  const ultimo = mensajes[mensajes.length - 1].ocurridoEn;
  // Autor: quien atiende el número; si nadie, el último que escribió desde Voltia PM.
  const autorId =
    bandeja.responsable?.id ??
    [...mensajes].reverse().find((m) => m.enviadoPor)?.enviadoPor?.id ??
    (await usuarioSistemaWhatsApp());
  if (!autorId) return;

  if (projectId) {
    const hubo = mensajes.some((m) => m.direccion === "SALIENTE");
    const direction = hubo ? InteractionDirection.SALIENTE : InteractionDirection.ENTRANTE;
    const existente = await prisma.clientInteraction.findFirst({
      where: { projectId, channel: InteractionChannel.WHATSAPP, content: { startsWith: cabecera }, createdAt: { gte: desde, lt: hasta } },
      select: { id: true, deletedAt: true },
    });
    // Si alguien la borró a mano, no se vuelve a crear ese día.
    if (existente?.deletedAt) return;
    const interaccionId = existente
      ? (
          await prisma.clientInteraction.update({
            where: { id: existente.id },
            data: { content: contenido, direction, createdAt: ultimo },
            select: { id: true },
          })
        ).id
      : (
          await prisma.clientInteraction.create({
            data: { projectId, channel: InteractionChannel.WHATSAPP, direction, content: contenido, authorId: autorId, createdAt: ultimo },
            select: { id: true },
          })
        ).id;
    // Si Voltia escribió, la IA mira (unos minutos después) si la conversación
    // cumple algún paso del recorrido. Solo sugiere: no tilda nada.
    if (hubo) programarSugerenciaPasos(projectId, interaccionId);
    return;
  }

  const existente = await prisma.salesActivity.findFirst({
    where: { leadId: leadId!, action: ACCION_CONVERSACION_LEAD, notes: { startsWith: cabecera }, createdAt: { gte: desde, lt: hasta } },
    select: { id: true },
  });
  if (existente) {
    await prisma.salesActivity.update({ where: { id: existente.id }, data: { notes: contenido, createdAt: ultimo } });
  } else {
    await prisma.salesActivity.create({
      data: { leadId: leadId!, userId: autorId, action: ACCION_CONVERSACION_LEAD, notes: contenido, createdAt: ultimo },
    });
  }
}

let sistemaWhatsAppId: string | null | undefined;
async function usuarioSistemaWhatsApp(): Promise<string | null> {
  if (sistemaWhatsAppId !== undefined) return sistemaWhatsAppId;
  const u = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  sistemaWhatsAppId = u?.id ?? null;
  return sistemaWhatsAppId;
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
    select: { id: true, clientPhone: true, contacto: { select: { telefono: true } } },
  });
  if (!p) throw notFound("PROYECTO_NO_ENCONTRADO", "El proyecto no existe");
  const propios = [...new Set([...telefonosDe(p.clientPhone), ...(p.contacto?.telefono ? [p.contacto.telefono] : [])])];
  return resumenDeConversaciones(bandeja, propios, (a) => a.projectId, projectId);
}

/** Lo mismo para el panel del lead, por el número del asesor. */
export async function whatsappDeLead(bandeja: Bandeja, leadId: string) {
  const l = await prisma.salesLead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true, clientPhone: true, contacto: { select: { telefono: true } } },
  });
  if (!l) throw notFound("LEAD_NO_ENCONTRADO", "El lead no existe");
  // El teléfono del lead y el de su contacto del CRM.
  const propios = [...new Set([...telefonosDe(l.clientPhone), ...(l.contacto?.telefono ? [l.contacto.telefono] : [])])];
  return resumenDeConversaciones(bandeja, propios, (a) => a.leadId, leadId);
}

type Asociada = { telefono: string; projectId: string | null; leadId: string | null; leidoHasta: Date | null; resueltoHasta: Date | null };

async function resumenDeConversaciones(
  bandeja: Bandeja,
  propios: string[],
  asociadoA: (a: Asociada) => string | null,
  id: string,
) {
  if (!bandeja.cuenta) {
    return { hayNumero: false, telefono: propios[0] ?? null, sinContestar: null, noLeida: false, mensajes: [] };
  }
  const phoneNumberId = bandeja.cuenta.phoneNumberId;
  const asociadas: Asociada[] = await prisma.whatsAppConversacion.findMany({
    where: { phoneNumberId },
    select: { telefono: true, projectId: true, leadId: true, leidoHasta: true, resueltoHasta: true },
  });
  // Los del teléfono cargado, salvo que se hayan asociado a mano a otro; más los
  // que se asociaron a mano a este.
  const ajenos = new Set(asociadas.filter((a) => asociadoA(a) && asociadoA(a) !== id).map((a) => a.telefono));
  const telefonos = [
    ...new Set([...propios.filter((t) => !ajenos.has(t)), ...asociadas.filter((a) => asociadoA(a) === id).map((a) => a.telefono)]),
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
  const mensajes = principal ? await mensajesDe(bandeja, telefono, 6) : [];
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
