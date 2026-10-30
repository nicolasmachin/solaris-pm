/**
 * Administración de los avisos automáticos: crear, editar, mandar la plantilla a
 * Meta, seguir su aprobación, activar y pausar. El envío está en emitir.ts.
 *
 * Estados:
 *   WhatsApp: BORRADOR → (se manda a Meta) EN_REVISION → LISTO | RECHAZADO
 *             LISTO → ACTIVO ⇄ PAUSADO
 *   Mail:     BORRADOR → ACTIVO ⇄ PAUSADO (no pasa por Meta)
 * Cambiar el texto de un aviso de WhatsApp lo vuelve a BORRADOR: el mensaje
 * aprobado es el que Meta revisó, y uno nuevo necesita su propia aprobación.
 */

import { randomBytes } from "node:crypto";

import { AuditAction, AuditEntityType, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { CHECKS_POR_RECORRIDO } from "../clientes/recorrido-checks.js";
import { DISPARADOR_POR_CLAVE, DISPARADORES, VARIABLES, variablesDe } from "./disparadores.js";
import { aFormatoMeta, nombrePlantilla, problemasDelTexto } from "./plantilla.js";

export type Canal = "WHATSAPP" | "EMAIL";

export type DatosAviso = {
  nombre: string;
  disparador: string;
  dias?: number | null;
  canal: Canal;
  asunto?: string | null;
  cuerpo: string;
  cierraCheck?: string | null;
};

/** Lo que la pantalla necesita para armar un aviso. */
export function catalogo() {
  const checks = Object.entries(CHECKS_POR_RECORRIDO).flatMap(([recorrido, defs]) =>
    defs.map((d) => ({ codigo: d.codigo, etiqueta: `${recorrido} · ${d.titulo}` })),
  );
  return {
    disparadores: DISPARADORES.map((d) => ({ ...d, variables: variablesDe(d.clave) })),
    variables: Object.entries(VARIABLES).map(([clave, v]) => ({ clave, ...v })),
    checks,
  };
}

function validar(d: DatosAviso) {
  const disp = DISPARADOR_POR_CLAVE.get(d.disparador);
  if (!disp) throw badRequest("DISPARADOR_INVALIDO", "Ese disparador no existe.");
  if (disp.conDias && (!d.dias || d.dias < 1 || d.dias > 30)) {
    throw badRequest("DIAS_INVALIDOS", "Elegí cuántos días antes (de 1 a 30).");
  }
  if (d.canal === "EMAIL" && !d.asunto?.trim()) throw badRequest("SIN_ASUNTO", "El mail necesita asunto.");
  const problemas = problemasDelTexto(d.cuerpo, d.disparador, d.canal);
  if (d.canal === "EMAIL" && d.asunto) problemas.push(...problemasDelTexto(d.asunto, d.disparador, "EMAIL"));
  if (problemas.length > 0) throw badRequest("TEXTO_INVALIDO", problemas.join(" "));
  if (d.cierraCheck) {
    const validos = new Set(Object.values(CHECKS_POR_RECORRIDO).flat().map((c) => c.codigo));
    if (!validos.has(d.cierraCheck)) throw badRequest("CHECK_INVALIDO", "Ese paso del recorrido no existe.");
  }
}

export async function listarAvisos() {
  const avisos = await prisma.avisoAutomatico.findMany({
    where: { deletedAt: null },
    orderBy: [{ disparador: "asc" }, { createdAt: "asc" }],
    include: { creadoPor: { select: { name: true } } },
  });
  const conteos = await prisma.avisoEnvio.groupBy({
    by: ["avisoId", "estado"],
    where: { avisoId: { in: avisos.map((a) => a.id) } },
    _count: true,
  });
  return avisos.map((a) => ({
    ...a,
    creadoPor: a.creadoPor?.name ?? null,
    disparadorEtiqueta: DISPARADOR_POR_CLAVE.get(a.disparador)?.etiqueta ?? a.disparador,
    envios: Object.fromEntries(conteos.filter((c) => c.avisoId === a.id).map((c) => [c.estado, c._count])),
  }));
}

async function obtener(id: string) {
  const a = await prisma.avisoAutomatico.findFirst({ where: { id, deletedAt: null } });
  if (!a) throw notFound("AVISO_NO_ENCONTRADO", "El aviso no existe.");
  return a;
}

async function auditar(avisoId: string, userId: string, description: string) {
  await createAuditEntry({
    entityType: AuditEntityType.aviso_automatico,
    entityId: avisoId,
    userId,
    action: AuditAction.updated,
    description,
  });
}

export async function crearAviso(d: DatosAviso, userId: string) {
  validar(d);
  const a = await prisma.avisoAutomatico.create({
    data: {
      nombre: d.nombre.trim(),
      disparador: d.disparador,
      dias: DISPARADOR_POR_CLAVE.get(d.disparador)?.conDias ? d.dias ?? null : null,
      canal: d.canal,
      asunto: d.canal === "EMAIL" ? d.asunto?.trim() ?? null : null,
      cuerpo: d.cuerpo.trim(),
      cierraCheck: d.cierraCheck || null,
      creadoPorId: userId,
    },
  });
  await createAuditEntry({
    entityType: AuditEntityType.aviso_automatico,
    entityId: a.id,
    userId,
    action: AuditAction.created,
    description: `Creó el aviso automático «${a.nombre}» (${d.canal === "WHATSAPP" ? "WhatsApp" : "mail"}, ${DISPARADOR_POR_CLAVE.get(a.disparador)?.etiqueta})`,
  });
  return a;
}

export async function editarAviso(id: string, d: DatosAviso, userId: string) {
  const actual = await obtener(id);
  if (d.canal !== actual.canal) throw badRequest("CANAL_FIJO", "El canal no se cambia: creá otro aviso.");
  validar(d);
  const cambiaTexto = d.cuerpo.trim() !== actual.cuerpo;
  // En WhatsApp, un texto nuevo es una plantilla nueva: vuelve a borrador y se apaga.
  const reinicia = actual.canal === "WHATSAPP" && cambiaTexto;
  const a = await prisma.avisoAutomatico.update({
    where: { id },
    data: {
      nombre: d.nombre.trim(),
      disparador: d.disparador,
      dias: DISPARADOR_POR_CLAVE.get(d.disparador)?.conDias ? d.dias ?? null : null,
      asunto: actual.canal === "EMAIL" ? d.asunto?.trim() ?? null : null,
      cuerpo: d.cuerpo.trim(),
      cierraCheck: d.cierraCheck || null,
      ...(reinicia
        ? {
            estado: "BORRADOR",
            activadoEn: null,
            plantillaNombre: null,
            plantillaId: null,
            plantillaEstado: null,
            plantillaMotivo: null,
            plantillaVariables: Prisma.DbNull,
          }
        : {}),
    },
  });
  await auditar(
    id,
    userId,
    `Editó el aviso automático «${a.nombre}»${cambiaTexto ? " (cambió el texto)" : ""}${reinicia && actual.estado === "ACTIVO" ? "; quedó apagado hasta que Meta apruebe el texto nuevo" : ""}`,
  );
  return a;
}

/** Manda el texto a Meta como plantilla nueva. */
export async function mandarAMeta(id: string, userId: string) {
  const a = await obtener(id);
  if (a.canal !== "WHATSAPP") throw badRequest("NO_ES_WHATSAPP", "Solo los avisos de WhatsApp pasan por Meta.");
  if (a.estado !== "BORRADOR" && a.estado !== "RECHAZADO") {
    throw badRequest("YA_ENVIADO", "Este texto ya se mandó a Meta. Para cambiarlo, editá el mensaje.");
  }
  const { crearPlantilla } = await import("../whatsapp-cloud/api.service.js");
  const { cuerpo, variables, ejemplos } = aFormatoMeta(a.cuerpo);
  const nombre = nombrePlantilla(a.nombre, randomBytes(2).toString("hex"));
  const r = await crearPlantilla({ nombre, categoria: "UTILITY", idioma: a.plantillaIdioma, cuerpo, ejemplos });
  const estadoMeta = r.status?.toUpperCase() ?? "PENDING";
  const actualizado = await prisma.avisoAutomatico.update({
    where: { id },
    data: {
      plantillaNombre: nombre,
      plantillaId: r.id,
      plantillaEstado: estadoMeta,
      plantillaMotivo: null,
      plantillaVariables: variables,
      estado: estadoMeta === "APPROVED" ? "LISTO" : estadoMeta === "REJECTED" ? "RECHAZADO" : "EN_REVISION",
    },
  });
  await auditar(id, userId, `Mandó a Meta la plantilla «${nombre}» del aviso «${a.nombre}»`);
  return actualizado;
}

/** Trae de Meta el estado de las plantillas en revisión (y de las activas, por si Meta las pausó). */
export async function refrescarPlantillas() {
  const pendientes = await prisma.avisoAutomatico.findMany({
    where: { deletedAt: null, canal: "WHATSAPP", plantillaNombre: { not: null } },
  });
  if (pendientes.length === 0) return 0;
  const { faltantesParaEnviar } = await import("../whatsapp-cloud/config.js");
  if (faltantesParaEnviar().length > 0) return 0;
  const { listarPlantillas } = await import("../whatsapp-cloud/api.service.js");
  const deMeta = new Map((await listarPlantillas()).map((p) => [p.name, p]));
  let cambios = 0;
  for (const a of pendientes) {
    const p = deMeta.get(a.plantillaNombre!);
    if (!p) continue;
    const estadoMeta = p.status.toUpperCase();
    if (estadoMeta === a.plantillaEstado) continue;
    let estado = a.estado;
    if (a.estado === "EN_REVISION" && estadoMeta === "APPROVED") estado = "LISTO";
    if (a.estado === "EN_REVISION" && estadoMeta === "REJECTED") estado = "RECHAZADO";
    await prisma.avisoAutomatico.update({
      where: { id: a.id },
      data: { plantillaEstado: estadoMeta, plantillaMotivo: p.rejected_reason && p.rejected_reason !== "NONE" ? p.rejected_reason : null, estado },
    });
    cambios++;
  }
  return cambios;
}

export async function activarAviso(id: string, userId: string) {
  const a = await obtener(id);
  if (a.canal === "WHATSAPP" && a.plantillaEstado !== "APPROVED") {
    throw badRequest("SIN_APROBAR", "Meta todavía no aprobó el mensaje: se activa cuando esté aprobado.");
  }
  if (a.estado === "ACTIVO") return a;
  const r = await prisma.avisoAutomatico.update({ where: { id }, data: { estado: "ACTIVO", activadoEn: new Date() } });
  await auditar(id, userId, `Activó el aviso automático «${a.nombre}»: desde ahora sale con cada hecho nuevo`);
  return r;
}

export async function pausarAviso(id: string, userId: string) {
  const a = await obtener(id);
  if (a.estado !== "ACTIVO") throw badRequest("NO_ACTIVO", "El aviso no está activo.");
  const r = await prisma.avisoAutomatico.update({ where: { id }, data: { estado: "PAUSADO" } });
  await auditar(id, userId, `Pausó el aviso automático «${a.nombre}»`);
  return r;
}

export async function borrarAviso(id: string, userId: string) {
  const a = await obtener(id);
  await prisma.avisoAutomatico.update({ where: { id }, data: { deletedAt: new Date(), estado: "PAUSADO" } });
  await auditar(id, userId, `Borró el aviso automático «${a.nombre}»`);
}

/** El registro de envíos: de un aviso o de todos, lo más nuevo primero. */
export async function listarEnvios(params: { avisoId?: string; projectId?: string; limite?: number }) {
  const filas = await prisma.avisoEnvio.findMany({
    where: { avisoId: params.avisoId, projectId: params.projectId },
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limite ?? 100, 500),
    include: {
      aviso: { select: { nombre: true, canal: true } },
      project: { select: { code: true, clientName: true } },
    },
  });
  const ids = filas.map((f) => f.waMessageId).filter((x): x is string => !!x);
  const estadosWa = ids.length
    ? await prisma.whatsAppMensaje.findMany({ where: { waMessageId: { in: ids } }, select: { waMessageId: true, estado: true } })
    : [];
  const porId = new Map(estadosWa.map((m) => [m.waMessageId, m.estado]));
  return filas.map((f) => ({ ...f, estadoWhatsApp: f.waMessageId ? porId.get(f.waMessageId) ?? null : null }));
}
