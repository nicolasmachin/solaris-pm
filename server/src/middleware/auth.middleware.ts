import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { registrarSesionCaida } from "../services/login-attempts.service.js";
import { unauthorized } from "../utils/errors.js";

/**
 * La sesión se renueva sola mientras se usa: si el token tiene más de una hora,
 * la respuesta trae uno nuevo en `X-Renewed-Token` y el cliente lo guarda. Así el
 * vencimiento (`JWT_EXPIRES_IN`, 10 días) se cuenta desde la última vez que se usó
 * Voltia PM y no desde que se entró: quien lo usa al menos una vez cada 10 días
 * no vuelve a ver el login.
 */
const RENOVAR_DESPUES_DE_SEGUNDOS = 60 * 60;

type JwtPayload = {
  sub: string;
  email: string | null;
  name: string;
  role: string;
  /**
   * Presente solo en tokens de propósito acotado (ej. `ensayo-stream`, que
   * autoriza reproducir UN video por 15 minutos). Un token de sesión nunca lo
   * lleva, y `authenticate` los rechaza: sin esa asimetría, un token acotado
   * filtrado por la URL de un `<video>` valdría como sesión completa.
   */
  typ?: string;
  iat?: number;
};

export async function authenticate(request: import("fastify").FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw unauthorized("Token Bearer requerido");
  }

  const token = header.slice("Bearer ".length);
  let payload: JwtPayload;

  try {
    payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch (err) {
    // Se anota por qué se cayó la sesión, para poder explicarle a quien lo saca.
    const decodificado = jwt.decode(token) as JwtPayload | null;
    const vencida = err instanceof jwt.TokenExpiredError;
    await registrarSesionCaida(request, {
      userId: decodificado?.sub ?? null,
      identifier: decodificado?.email ?? decodificado?.sub ?? "(token ilegible)",
      reason: vencida ? "SESION_VENCIDA" : "SESION_INVALIDA",
    });
    throw unauthorized(
      vencida
        ? "Tu sesión venció porque pasaron más de 10 días sin entrar. Volvé a entrar."
        : "Token inválido o expirado",
    );
  }

  if (payload.typ) {
    throw unauthorized("Este token no habilita el acceso a la API");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { name: true } },
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw unauthorized("El usuario del token no existe");
  }

  request.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
  };

  if (payload.iat && Date.now() / 1000 - payload.iat > RENOVAR_DESPUES_DE_SEGUNDOS) {
    request.renewedToken = signToken(request.user);
  }
}

export function signToken(user: { id: string; email: string | null; name: string; role: string }) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    },
  );
}
