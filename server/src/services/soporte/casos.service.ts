// Casos de Soporte: abrir, actualizar, cerrar y avisar. Ver vigia.service.ts.

import { Action, Module, NotificationType, SoporteCasoEstado, SoporteCasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createNotification } from "../notification.service.js";
import { alarmasPlanta, webConfigurada } from "../reportesFv/growatt/web.client.js";

/**
 * "La planta está caída": una sola abierta por proyecto entre estas tres. Si
 * pasa de "no genera" a "falla con código" es el mismo problema mejor
 * explicado, no un caso nuevo.
 */
export const TIPOS_CAIDA: SoporteCasoTipo[] = [
  SoporteCasoTipo.SIN_GENERACION,
  SoporteCasoTipo.SIN_COMUNICACION,
  SoporteCasoTipo.FALLA_INVERSOR,
];

const grupo = (t: SoporteCasoTipo) => (TIPOS_CAIDA.includes(t) ? TIPOS_CAIDA : [t]);

/** Quién recibe las alertas: los roles con SOPORTE:VIEW (por ahora, ADMIN). */
async function equipoSoporte(): Promise<string[]> {
  const perms = await prisma.permission.findMany({
    where: { module: Module.SOPORTE, action: Action.VIEW },
    select: { roleId: true },
  });
  const users = await prisma.user.findMany({
    where: { deletedAt: null, roleId: { in: perms.map((p) => p.roleId) } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export type NuevoCaso = {
  projectId: string;
  growattPlantId?: bigint | null;
  huaweiPlantCode?: string | null;
  tipo: SoporteCasoTipo;
  titulo: string;
  detalle: string;
  codigoFalla?: number | null;
  llaveDelCliente?: boolean;
};

/** Abre el caso, o actualiza el abierto del mismo grupo. Avisa al equipo solo al abrir. */
export async function abrirOActualizar(c: NuevoCaso): Promise<{ id: string; nuevo: boolean }> {
  const abierto = await prisma.soporteCaso.findFirst({
    where: { projectId: c.projectId, estado: SoporteCasoEstado.ABIERTO, tipo: { in: grupo(c.tipo) } },
  });
  if (abierto) {
    // Un caso que se repite conserva su texto (con las fechas en que pasó):
    // solo se marca que se volvió a ver.
    if (abierto.recurrente) {
      await prisma.soporteCaso.update({ where: { id: abierto.id }, data: { ultimaVezEn: new Date() } });
      return { id: abierto.id, nuevo: false };
    }
    await prisma.soporteCaso.update({
      where: { id: abierto.id },
      data: {
        tipo: c.tipo,
        titulo: c.titulo,
        detalle: c.detalle,
        codigoFalla: c.codigoFalla ?? abierto.codigoFalla,
        llaveDelCliente: c.llaveDelCliente ?? abierto.llaveDelCliente,
        ultimaVezEn: new Date(),
      },
    });
    return { id: abierto.id, nuevo: false };
  }
  const caso = await prisma.soporteCaso.create({
    data: {
      projectId: c.projectId,
      growattPlantId: c.growattPlantId ?? null,
      huaweiPlantCode: c.huaweiPlantCode ?? null,
      tipo: c.tipo,
      titulo: c.titulo,
      detalle: c.detalle,
      codigoFalla: c.codigoFalla ?? null,
      llaveDelCliente: c.llaveDelCliente ?? false,
    },
    include: { project: { select: { clientName: true } } },
  });
  for (const userId of await equipoSoporte()) {
    await createNotification({
      userId,
      projectId: c.projectId,
      type: NotificationType.soporte_alerta,
      title: `${caso.project.clientName}: ${c.titulo}`,
      message: c.detalle,
      link: "/soporte",
    }).catch((e) => console.error("[soporte] no se pudo avisar al equipo:", e));
  }
  return { id: caso.id, nuevo: true };
}

/**
 * Cierra solos los casos abiertos de esos tipos (la planta volvió). Los que se
 * repiten no: vuelven mañana, los cierra una persona.
 */
export async function cerrarAutomatico(projectId: string, tipos: SoporteCasoTipo[], motivo: string) {
  const r = await prisma.soporteCaso.updateMany({
    where: { projectId, estado: SoporteCasoEstado.ABIERTO, tipo: { in: tipos }, recurrente: false },
    data: { estado: SoporteCasoEstado.RESUELTO, resueltoEn: new Date(), motivoCierre: motivo },
  });
  return r.count;
}

export async function cerrarManual(id: string, userId: string, estado: "RESUELTO" | "DESCARTADO", motivo: string) {
  const caso = await prisma.soporteCaso.findUnique({ where: { id } });
  if (!caso) throw notFound("CASO_NO_ENCONTRADO", "El caso no existe");
  if (caso.estado !== SoporteCasoEstado.ABIERTO) throw badRequest("CASO_CERRADO", "El caso ya está cerrado");
  return prisma.soporteCaso.update({
    where: { id },
    data: { estado, resueltoEn: new Date(), resueltoPorId: userId, motivoCierre: motivo.trim() || null },
  });
}

/** El mensaje que se le propone al cliente. Se puede editar antes de mandarlo. */
export function mensajeSugerido(tipo: SoporteCasoTipo, llaveDelCliente: boolean): string {
  switch (tipo) {
    case SoporteCasoTipo.SIN_GENERACION:
    case SoporteCasoTipo.FALLA_INVERSOR:
      return llaveDelCliente
        ? "Detectamos que tu planta no está generando: el inversor no ve la red de UTE. Lo más común es que la llave de microgeneración del tablero esté bajada o haya saltado. ¿Podés fijarte y subirla? Si está arriba o vuelve a saltar, avisanos y coordinamos una visita."
        : "Detectamos que tu planta no está generando. Ya lo estamos revisando y te escribimos en cuanto sepamos qué pasa.";
    case SoporteCasoTipo.SIN_COMUNICACION:
      return "Tu planta dejó de mandarnos datos. Suele ser el wifi de la casa (un corte, o cambio de router o de clave). ¿Podés fijarte si el wifi anda? Si cambiaste algo, avisanos y te ayudamos a reconectarla.";
    case SoporteCasoTipo.BAJO_RENDIMIENTO:
      return "Vimos que en los últimos días tu planta generó bastante menos de lo normal para ella. Lo estamos revisando y te avisamos qué encontramos.";
  }
}

/**
 * Avisa al cliente (todos los usuarios de portal del proyecto): campanita del
 * portal y aviso al celular si lo activó. Lo dispara una persona: el vigía
 * nunca le escribe solo al cliente.
 */
export async function avisarCliente(id: string, userId: string, mensaje: string) {
  const texto = mensaje.trim();
  if (texto.length < 10) throw badRequest("MENSAJE_CORTO", "Escribí el mensaje para el cliente");
  const caso = await prisma.soporteCaso.findUnique({
    where: { id },
    include: { project: { select: { clients: { select: { userId: true } } } } },
  });
  if (!caso) throw notFound("CASO_NO_ENCONTRADO", "El caso no existe");
  const clientes = caso.project.clients.map((c) => c.userId);
  if (clientes.length === 0) {
    throw badRequest("SIN_USUARIO_PORTAL", "El cliente no tiene usuario del portal: avisale por WhatsApp.");
  }
  for (const u of clientes) {
    await createNotification({
      userId: u,
      projectId: caso.projectId,
      type: NotificationType.soporte_aviso_cliente,
      title: "Aviso sobre tu planta",
      message: texto,
      link: "/portal",
    });
  }
  await prisma.soporteCaso.update({
    where: { id },
    data: { clienteAvisadoEn: new Date(), clienteAvisadoPorId: userId, mensajeCliente: texto },
  });
  return { avisados: clientes.length };
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * ¿Es una falla que se repite? Se mira al abrir el caso, una sola vez:
 *  - casos de caída de la misma planta en los últimos 7 días, y
 *  - si hay código y credenciales de la web de Growatt, las alarmas del
 *    inversor del último mes (una consulta, solo de esta planta).
 * Si se repite, el caso queda marcado y no se cierra solo.
 */
export async function marcarSiSeRepite(
  casoId: string,
  projectId: string,
  growattPlantId: bigint | null,
  codigo: number | null,
): Promise<boolean> {
  const notas: string[] = [];
  const hace7 = new Date(Date.now() - 7 * 86_400_000);
  const previos = await prisma.soporteCaso.findMany({
    where: {
      projectId,
      id: { not: casoId },
      tipo: { in: [SoporteCasoTipo.FALLA_INVERSOR, SoporteCasoTipo.SIN_GENERACION] },
      detectadoEn: { gte: hace7 },
    },
    select: { detectadoEn: true },
  });
  if (previos.length) {
    notas.push(`Ya se cayó ${previos.length === 1 ? "otra vez" : `${previos.length} veces más`} en los últimos 7 días.`);
  }

  if (codigo && growattPlantId != null && webConfigurada()) {
    try {
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
      const desde = new Date(Date.now() - 30 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
      const alarmas = (await alarmasPlanta(String(growattPlantId), desde, hoy)).filter((a) =>
        new RegExp(`\\b${codigo}\\b`).test(a.codigo),
      );
      const dias = [...new Set(alarmas.map((a) => a.time.slice(0, 10)))].sort();
      if (dias.length >= 3) {
        const horas = alarmas.map((a) => a.time.slice(11, 16)).sort();
        notas.push(
          `El inversor dio esta falla ${dias.length} días en el último mes (${dias.map(ddmm).join(", ")}), alrededor de las ${horas[Math.floor(horas.length / 2)]}.`,
        );
      }
    } catch (err) {
      console.error("[soporte] no se pudieron leer las alarmas:", (err as Error).message);
    }
  }

  if (!notas.length) return false;
  const caso = await prisma.soporteCaso.findUnique({ where: { id: casoId }, select: { titulo: true, detalle: true } });
  if (!caso) return false;
  await prisma.soporteCaso.update({
    where: { id: casoId },
    data: {
      recurrente: true,
      titulo: `Se repite: ${caso.titulo}`,
      detalle: `${notas.join(" ")} ${caso.detalle} Como se repite, el caso no se cierra solo cuando vuelve a generar.`,
    },
  });
  return true;
}
