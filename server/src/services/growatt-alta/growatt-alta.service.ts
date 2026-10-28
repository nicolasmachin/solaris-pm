// Alta del cliente en la aplicación del inversor (Growatt), hecha por él mismo.
//
// Antes (hasta oct-2026) alguien de Voltia creaba el visitante en la web de
// Growatt, inventaba una contraseña y se la mandaba por WhatsApp. Ahora Voltia
// manda un link de un solo uso; el cliente elige usuario y contraseña en una
// página de Voltia PM, y el servidor crea el visitante en Growatt con su planta
// (growatt/web.client.ts → crearVisitanteGrowatt). La contraseña no se guarda:
// pasa del formulario a Growatt y se descarta.
//
// También se puede desde el portal (canal PORTAL), sin link: el cliente ya está
// identificado.

import crypto from "node:crypto";

import { AuditAction, AuditEntityType } from "@prisma/client";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import {
  crearVisitanteGrowatt,
  usuarioGrowattExiste,
  validarVisitante,
  webConfigurada,
} from "../reportesFv/growatt/web.client.js";
import { badRequest, notFound } from "../../utils/errors.js";

const VIGENCIA_DIAS = 7;
const MAX_INTENTOS = 10;

const sha256 = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Dónde abre el cliente el link: la misma URL pública de Voltia PM. */
function baseUrl(): string {
  return (process.env.APP_PUBLIC_URL || env.mcpPublicUrl || "").replace(/\/+$/, "");
}

export const LINKS_APP = {
  iphone: "https://apps.apple.com/uy/app/shinephone/id669936054?l=es-MX",
  android: "https://play.google.com/store/apps/details?id=com.growatt.shinephones&hl=en_US",
  web: "https://server.growatt.com",
};

/** La planta Growatt del proyecto, si está vinculada y no ignorada. */
async function plantaDelProyecto(projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      code: true,
      clientName: true,
      nombreCliente: true,
      clientEmail: true,
      clientPhone: true,
      growattPlant: { select: { plantId: true, name: true, ignorada: true } },
    },
  });
  if (!p) return null;
  const planta = p.growattPlant && !p.growattPlant.ignorada ? p.growattPlant : null;
  return { ...p, planta };
}

const primerNombre = (n: string) => (n.trim().split(/\s+/)[0] ?? "").trim();

function telefonoWhatsapp(tel: string | null | undefined): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("598")) return d;
  return "598" + d.replace(/^0/, "");
}


/**
 * Visitante creado a mano antes de esta herramienta: queda solo en el
 * comentario "Cuenta de visitante Growatt CREADA: usuario 'x'" de la ficha.
 */
async function visitanteManual(projectId: string): Promise<{ usuario: string; cuando: Date } | null> {
  const c = await prisma.comment.findFirst({
    where: { projectId, deletedAt: null, content: { startsWith: "Cuenta de visitante Growatt CREADA" } },
    orderBy: { createdAt: "desc" },
    select: { content: true, createdAt: true },
  });
  const m = c?.content.match(/usuario '([^']+)'/);
  return m ? { usuario: m[1], cuando: c!.createdAt } : null;
}

// ─── Del lado de Voltia ───────────────────────────────────────────────────────

/** Estado del alta de un proyecto, para la ficha. */
export async function estadoAltaProyecto(projectId: string) {
  const p = await plantaDelProyecto(projectId);
  if (!p) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  const altas = await prisma.growattAltaVisitante.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, canal: true, expiraEn: true, usadoEn: true, usuarioCreado: true, anuladoEn: true, createdAt: true },
  });
  const hecha = altas.find((a) => a.usadoEn);
  const manual = hecha ? null : await visitanteManual(projectId);
  const ahora = new Date();
  const pendiente = altas.find((a) => !a.usadoEn && !a.anuladoEn && a.expiraEn > ahora && a.canal === "LINK");
  return {
    tienePlantaGrowatt: !!p.planta,
    plantaNombre: p.planta?.name.trim() ?? null,
    webConfigurada: webConfigurada(),
    hecha: hecha
      ? { usuario: hecha.usuarioCreado, cuando: hecha.usadoEn, canal: hecha.canal }
      : manual
        ? { usuario: manual.usuario, cuando: manual.cuando, canal: "MANUAL" }
        : null,
    linkPendiente: pendiente ? { expiraEn: pendiente.expiraEn, creadoEn: pendiente.createdAt } : null,
  };
}

/**
 * Genera el link de alta (anula los anteriores sin usar). El token en claro
 * solo vuelve acá: en la base queda su hash.
 */
export async function generarLinkAlta(projectId: string, userId: string) {
  const p = await plantaDelProyecto(projectId);
  if (!p) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  if (!p.planta) {
    throw badRequest("SIN_PLANTA_GROWATT", "El proyecto no tiene una planta de Growatt vinculada. Vincularla antes de mandar el link.");
  }
  await prisma.growattAltaVisitante.updateMany({
    where: { projectId, usadoEn: null, anuladoEn: null },
    data: { anuladoEn: new Date() },
  });
  const token = crypto.randomBytes(24).toString("base64url");
  const expiraEn = new Date(Date.now() + VIGENCIA_DIAS * 86_400_000);
  await prisma.growattAltaVisitante.create({
    data: { projectId, tokenHash: sha256(token), canal: "LINK", expiraEn, creadoPorId: userId },
  });
  const url = `${baseUrl()}/alta-app/${token}`;
  const nombre = primerNombre(p.nombreCliente || p.clientName);
  const mensaje =
    `Hola${nombre ? ` ${nombre}` : ""}! Para ver la generación de tu planta en la aplicación del inversor, ` +
    `entrá a este link y elegí tu usuario y contraseña:\n${url}\n\n` +
    `El link vale por ${VIGENCIA_DIAS} días y sirve una sola vez.`;
  const tel = telefonoWhatsapp(p.clientPhone);
  await createAuditEntry({
    entityType: AuditEntityType.project,
    entityId: projectId,
    projectId,
    userId,
    action: AuditAction.created,
    description: "Generó el link para que el cliente cree su acceso a la aplicación del inversor",
  });
  return {
    url,
    expiraEn,
    mensaje,
    whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}` : null,
  };
}

// ─── Del lado del cliente ─────────────────────────────────────────────────────

type EstadoLink = "VALIDO" | "VENCIDO" | "USADO" | "INEXISTENTE";

async function buscarPorToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.growattAltaVisitante.findUnique({ where: { tokenHash: sha256(token) } });
}

function estadoDe(a: { usadoEn: Date | null; anuladoEn: Date | null; expiraEn: Date; intentos: number } | null): EstadoLink {
  if (!a) return "INEXISTENTE";
  if (a.usadoEn) return "USADO";
  if (a.anuladoEn || a.expiraEn <= new Date() || a.intentos >= MAX_INTENTOS) return "VENCIDO";
  return "VALIDO";
}

/** Lo que muestra la página del link antes de enviar. */
export async function infoLink(token: string) {
  const a = await buscarPorToken(token);
  const estado = estadoDe(a);
  if (!a || estado !== "VALIDO") return { estado };
  const p = await plantaDelProyecto(a.projectId);
  if (!p?.planta) return { estado: "VENCIDO" as EstadoLink };
  return {
    estado,
    nombre: primerNombre(p.nombreCliente || p.clientName),
    planta: p.planta.name.trim(),
    email: p.clientEmail ?? "",
    links: LINKS_APP,
  };
}

/** Respuesta de disponibilidad de un usuario, para avisar antes de enviar. */
export async function usuarioDisponible(token: string | null, projectId: string | null, usuario: string) {
  if (token) {
    const a = await buscarPorToken(token);
    if (estadoDe(a) !== "VALIDO") return { disponible: false, motivo: "El link ya no es válido." };
  } else if (!projectId) {
    return { disponible: false, motivo: "Falta el proyecto." };
  }
  const error = validarVisitante(usuario, "xxxxxx", "a@b.co");
  if (error) return { disponible: false, motivo: error };
  const existe = await usuarioGrowattExiste(usuario);
  return existe ? { disponible: false, motivo: "Ese usuario ya existe en Growatt: elegí otro." } : { disponible: true };
}

interface DatosAlta {
  usuario: string;
  password: string;
  email: string;
}

/** Crea el visitante y deja registro. Común a los dos canales. */
async function crearYRegistrar(
  alta: { id: string; projectId: string; creadoPorId: string | null; canal: string },
  datos: DatosAlta,
) {
  const p = await plantaDelProyecto(alta.projectId);
  if (!p?.planta) throw badRequest("SIN_PLANTA_GROWATT", "Esta planta todavía no está lista. Avisale a Voltia.");
  const error = validarVisitante(datos.usuario, datos.password, datos.email);
  if (error) throw badRequest("DATOS_INVALIDOS", error);

  const sumarIntento = () =>
    prisma.growattAltaVisitante.update({ where: { id: alta.id }, data: { intentos: { increment: 1 } } });

  if (await usuarioGrowattExiste(datos.usuario)) {
    await sumarIntento();
    throw badRequest("USUARIO_OCUPADO", "Ese usuario ya existe en Growatt: elegí otro.");
  }
  const rechazo = await crearVisitanteGrowatt({
    usuario: datos.usuario,
    password: datos.password,
    email: datos.email,
    nombre: p.nombreCliente || p.clientName,
    telefono: p.clientPhone,
    plantId: p.planta.plantId.toString(),
  });
  if (rechazo) {
    await sumarIntento();
    throw badRequest("GROWATT_RECHAZO", rechazo);
  }

  const usuario = datos.usuario.trim();
  await prisma.growattAltaVisitante.update({
    where: { id: alta.id },
    data: { usadoEn: new Date(), usuarioCreado: usuario },
  });
  // El comentario lo firma quien generó el link (o, desde el portal, queda a
  // nombre del cliente). Sin contraseña: la eligió el cliente y Voltia no la sabe.
  if (alta.creadoPorId) {
    await prisma.comment.create({
      data: {
        projectId: alta.projectId,
        authorId: alta.creadoPorId,
        content:
          `El cliente creó su acceso a la aplicación del inversor (visitante de Growatt): usuario '${usuario}'` +
          `${alta.canal === "PORTAL" ? ", desde el portal" : ", con el link de alta"}. La contraseña la eligió él; Voltia no la conoce. ` +
          `Si se la olvida, se le manda un link nuevo desde la ficha.`,
      },
    });
  }
  if (alta.creadoPorId) await createAuditEntry({
    entityType: AuditEntityType.project,
    entityId: alta.projectId,
    projectId: alta.projectId,
    userId: alta.creadoPorId,
    action: AuditAction.created,
    description: `El cliente creó su visitante de Growatt '${usuario}' (${alta.canal === "PORTAL" ? "portal" : "link"})`,
  });
  return { usuario, links: LINKS_APP };
}

/** Alta con el link. */
export async function completarConLink(token: string, datos: DatosAlta) {
  const a = await buscarPorToken(token);
  const estado = estadoDe(a);
  if (!a || estado !== "VALIDO") {
    throw badRequest("LINK_INVALIDO", estado === "USADO" ? "Este link ya se usó." : "Este link venció. Pedile uno nuevo a Voltia.");
  }
  return crearYRegistrar(a, datos);
}

// ─── Portal ───────────────────────────────────────────────────────────────────

/** Proyectos del cliente con planta Growatt y si ya tiene su acceso. */
export async function estadoPortal(clientUserId: string) {
  const vinculos = await prisma.projectClient.findMany({
    where: { userId: clientUserId, project: { deletedAt: null } },
    select: { projectId: true },
  });
  const out = [];
  for (const { projectId } of vinculos) {
    const p = await plantaDelProyecto(projectId);
    if (!p?.planta) continue;
    const hecha = await prisma.growattAltaVisitante.findFirst({
      where: { projectId, usadoEn: { not: null } },
      orderBy: { usadoEn: "desc" },
      select: { usuarioCreado: true },
    });
    const usuario = hecha?.usuarioCreado ?? (await visitanteManual(projectId))?.usuario ?? null;
    out.push({ projectId, planta: p.planta.name.trim(), usuario, email: p.clientEmail ?? "" });
  }
  return { proyectos: out, links: LINKS_APP };
}

export async function completarDesdePortal(clientUserId: string, projectId: string, datos: DatosAlta) {
  const propio = await prisma.projectClient.findFirst({ where: { userId: clientUserId, projectId }, select: { id: true } });
  if (!propio) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  const ya = await prisma.growattAltaVisitante.findFirst({ where: { projectId, usadoEn: { not: null } }, select: { id: true } });
  if (ya || (await visitanteManual(projectId))) throw badRequest("YA_TIENE_ACCESO", "Esta planta ya tiene su acceso creado. Si no lo recordás, escribinos.");
  const recientes = await prisma.growattAltaVisitante.aggregate({
    where: { projectId, canal: "PORTAL", createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    _sum: { intentos: true },
  });
  if ((recientes._sum.intentos ?? 0) >= MAX_INTENTOS) throw badRequest("DEMASIADOS_INTENTOS", "Demasiados intentos. Probá de nuevo mañana o escribinos.");
  // El comentario de la ficha lo firma el último que mandó link, si hay; si no,
  // queda solo la auditoría.
  const ultimoLink = await prisma.growattAltaVisitante.findFirst({
    where: { projectId, canal: "LINK" },
    orderBy: { createdAt: "desc" },
    select: { creadoPorId: true },
  });
  const alta = await prisma.growattAltaVisitante.create({
    data: { projectId, canal: "PORTAL", expiraEn: new Date(Date.now() + 3_600_000), creadoPorId: ultimoLink?.creadoPorId ?? clientUserId },
  });
  return crearYRegistrar(alta, datos);
}
