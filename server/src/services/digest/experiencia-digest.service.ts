/**
 * El resumen diario de Experiencia Solar: la vista del Recorrido, empujada al mail.
 *
 * Por qué existe aparte del digest general: el digest general resume lo que pasó
 * (notificaciones de las últimas 24 h). Este resume lo que **falta hacer**, con
 * la misma estructura y el mismo orden que la pantalla del Recorrido, para que
 * el mail y la app no cuenten dos historias distintas:
 *
 *   1. **Alertas rojas arriba** — lo que tiene reloj y ya venció: avisos de
 *      habilitación pendientes, pasos del recorrido vencidos y reclamos del
 *      cliente sin respuesta.
 *   2. **Por etapa (E1 → E2 → E3)** — quiénes están fuera de la cadencia de su
 *      etapa y quiénes tienen novedad sin avisar.
 *
 * Los pendientes que **se arrastran** no van en una sección propia: se marcan
 * dentro de la alerta con los días que llevan vencidos, que es la información
 * que hace falta (una lista separada obligaría a leer el mismo cliente dos veces).
 *
 * Quién lo recibe es opt-in por rol desde Administración, igual que el resto del
 * digest (`digest_preferences` + `NotificationType.resumen_experiencia`): no hay
 * roles hardcodeados acá.
 */

import { TicketEstado } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { getRecorrido } from "../clientes/index.js";
import { sendEmail } from "../email.service.js";
import { emailExperienciaDigest, type ExpAlerta, type ExpBloque } from "../email.templates.js";
import { getEnabledByRole } from "./digest-config.service.js";

const DIA_MS = 24 * 60 * 60 * 1000;

function diasDesde(fecha: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - fecha.getTime()) / DIA_MS));
}

export type ResumenExperiencia = {
  alertas: ExpAlerta[];
  bloques: ExpBloque[];
  /** Alertas + clientes listados en los bloques. 0 = no se manda nada. */
  total: number;
};

/**
 * Arma el resumen. Separado del envío para poder verificarlo por API/consola sin
 * mandar correos.
 */
export async function construirResumenExperiencia(now: Date = new Date()): Promise<ResumenExperiencia> {
  const bloquesRecorrido = await getRecorrido();

  // Nombre de proyecto por id, para las alertas (que salen de otras tablas).
  const nombrePorProyecto = new Map<string, string>();
  for (const b of bloquesRecorrido) {
    for (const c of b.clientes) nombrePorProyecto.set(c.projectId, c.nombre);
  }
  const projectIds = [...nombrePorProyecto.keys()];

  const alertas: ExpAlerta[] = [];

  // 1. Regla de Oro: UTE habilitó y todavía no se le avisó al cliente.
  for (const b of bloquesRecorrido) {
    for (const c of b.clientes) {
      if (!c.avisoHabilitacionPendiente) continue;
      alertas.push({
        tipo: "habilitacion",
        projectId: c.projectId,
        cliente: c.nombre,
        titulo: "Avisar la habilitación: ya puede encender",
        detalle: c.diasSinContacto === null ? "Sin contacto registrado" : `${c.diasSinContacto} días sin contacto`,
        dias: c.diasSinContacto,
      });
    }
  }

  // 2. Pasos del recorrido vencidos (los que tienen plazo y se pasaron).
  const checksVencidos = projectIds.length
    ? await prisma.recorridoCheck.findMany({
        where: {
          projectId: { in: projectIds },
          completadoEn: null,
          venceEn: { not: null, lt: now },
        },
        select: { projectId: true, titulo: true, venceEn: true, recorrido: true },
        orderBy: { venceEn: "asc" },
      })
    : [];
  for (const c of checksVencidos) {
    const dias = c.venceEn ? diasDesde(c.venceEn, now) : 0;
    alertas.push({
      tipo: "check",
      projectId: c.projectId,
      cliente: nombrePorProyecto.get(c.projectId) ?? "—",
      titulo: c.titulo,
      detalle: `${c.recorrido} · vencido hace ${dias} día${dias === 1 ? "" : "s"}`,
      dias,
    });
  }

  // 3. Reclamos del cliente sin respuesta nuestra: abiertos, abiertos por el
  //    cliente desde el portal y sin ningún comentario de alguien de Voltia.
  //    "Responder el mismo día hábil" es el compromiso; esto es lo que lo mide.
  const reclamos = await prisma.ticket.findMany({
    where: { deletedAt: null, estado: TicketEstado.ABIERTO, origenCliente: true },
    select: {
      id: true,
      projectId: true,
      titulo: true,
      createdAt: true,
      creadoPorId: true,
      project: { select: { clientName: true } },
      comentarios: { select: { autorId: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });
  const autorIds = [...new Set(reclamos.flatMap((t) => t.comentarios.map((c) => c.autorId)))];
  const internos = new Set(
    autorIds.length
      ? (
          await prisma.user.findMany({
            where: { id: { in: autorIds }, role: { name: { not: "CLIENT" } } },
            select: { id: true },
          })
        ).map((u) => u.id)
      : [],
  );
  for (const t of reclamos) {
    if (t.comentarios.some((c) => internos.has(c.autorId))) continue;
    const dias = diasDesde(t.createdAt, now);
    alertas.push({
      tipo: "reclamo",
      projectId: t.projectId,
      cliente: t.project?.clientName ?? "—",
      titulo: `Reclamo sin responder: ${t.titulo}`,
      detalle: `Abierto hace ${dias} día${dias === 1 ? "" : "s"}`,
      dias,
    });
  }

  // Lo más viejo primero: es lo que se viene arrastrando.
  alertas.sort((a, b) => (b.dias ?? Number.MAX_SAFE_INTEGER) - (a.dias ?? Number.MAX_SAFE_INTEGER));

  // Bloques por etapa: solo lo accionable (fuera de cadencia o con novedad sin
  // avisar). El orden viene ya resuelto por getRecorrido, no se reordena acá.
  const bloques: ExpBloque[] = bloquesRecorrido
    .map((b) => ({
      nombre: `${b.recorrido} · ${b.nombreCorto}`,
      total: b.total,
      clientes: b.clientes
        .filter((c) => c.fueraDeCadencia || c.hayNovedad)
        .map((c) => ({
          projectId: c.projectId,
          nombre: c.nombre,
          diasSinContacto: c.diasSinContacto,
          fueraDeCadencia: c.fueraDeCadencia,
          hayNovedad: c.hayNovedad,
        })),
    }))
    .filter((b) => b.clientes.length > 0);

  const total = alertas.length + bloques.reduce((acc, b) => acc + b.clientes.length, 0);
  return { alertas, bloques, total };
}

/**
 * Manda el resumen a los usuarios cuyo rol tenga habilitado `resumen_experiencia`
 * en Administración. Si no hay nada pendiente, no manda nada: un mail vacío
 * todos los días enseña a ignorarlo.
 */
export async function enviarDigestExperiencia(
  now: Date = new Date(),
): Promise<{ emails: number; total: number }> {
  const enabledByRole = await getEnabledByRole();
  const roles = [...enabledByRole.entries()]
    .filter(([, tipos]) => tipos.has("resumen_experiencia"))
    .map(([roleName]) => roleName);
  if (roles.length === 0) return { emails: 0, total: 0 };

  const resumen = await construirResumenExperiencia(now);
  if (resumen.total === 0) return { emails: 0, total: 0 };

  const users = await prisma.user.findMany({
    where: { deletedAt: null, email: { not: "" }, role: { name: { in: roles } } },
    select: { name: true, email: true },
  });

  let emails = 0;
  for (const user of users) {
    const template = emailExperienciaDigest({ userName: user.name, ...resumen });
    const ok = await sendEmail({ to: user.email, ...template, type: "internal" });
    if (ok) emails++;
  }
  return { emails, total: resumen.total };
}
