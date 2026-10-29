// Casos de Soporte: abrir, actualizar, cerrar y avisar. Ver vigia.service.ts.

import { Action, Module, NotificationType, SoporteCasoEstado, SoporteCasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createNotification } from "../notification.service.js";

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

/** Cierra solos los casos abiertos de esos tipos (la planta volvió). */
export async function cerrarAutomatico(projectId: string, tipos: SoporteCasoTipo[], motivo: string) {
  const r = await prisma.soporteCaso.updateMany({
    where: { projectId, estado: SoporteCasoEstado.ABIERTO, tipo: { in: tipos } },
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
