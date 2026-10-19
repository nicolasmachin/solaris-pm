import type { FastifyRequest } from "fastify";

import { prisma } from "../lib/prisma.js";

/**
 * Registro de los intentos de entrar a Voltia PM y de las sesiones que se caen.
 * Sirve para auditar por qué alguien no puede entrar o por qué lo saca: si
 * escribió un usuario que no existe, si le erra a la contraseña o al código, si
 * la sesión le venció. Nunca se guarda la contraseña ni el código.
 */

export type MetodoIngreso = "CONTRASENA" | "CODIGO_MAIL" | "SESION";

export type MotivoFalla =
  | "USUARIO_INEXISTENTE"
  | "CONTRASENA_INCORRECTA"
  | "USUARIO_DADO_DE_BAJA"
  | "USUARIO_SIN_EMAIL"
  | "CODIGO_INCORRECTO"
  | "CODIGO_VENCIDO"
  | "SESION_VENCIDA"
  | "SESION_INVALIDA";

/** Detrás de Caddy la IP real viene en `x-forwarded-for`; `request.ip` es la del contenedor. */
function ipReal(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || request.ip;
}

/** Si falla el registro, el flujo sigue: auditar no puede dejar a nadie afuera. */
export async function registrarIntento(
  request: FastifyRequest,
  params: {
    identifier: string;
    userId: string | null;
    method: MetodoIngreso;
    reason: MotivoFalla | null;
  },
) {
  try {
    await prisma.loginAttempt.create({
      data: {
        identifier: params.identifier.trim().slice(0, 200),
        userId: params.userId,
        success: params.reason === null,
        reason: params.reason,
        method: params.method,
        ip: ipReal(request),
        userAgent: request.headers["user-agent"]?.slice(0, 300) ?? null,
      },
    });
  } catch (err) {
    request.log.error({ err }, "No se pudo registrar el intento de login");
  }
}

/**
 * Una sesión que se cae dispara varias requests en paralelo, todas con 401. Para
 * no llenar la tabla, se anota una sola vez cada 10 minutos por usuario y motivo.
 */
export async function registrarSesionCaida(
  request: FastifyRequest,
  params: { userId: string | null; identifier: string; reason: "SESION_VENCIDA" | "SESION_INVALIDA" },
) {
  try {
    const reciente = await prisma.loginAttempt.findFirst({
      where: {
        method: "SESION",
        reason: params.reason,
        identifier: params.identifier,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (reciente) return;
    await registrarIntento(request, { ...params, method: "SESION" });
  } catch (err) {
    request.log.error({ err }, "No se pudo registrar la sesión caída");
  }
}
