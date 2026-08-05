import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { unauthorized } from "../utils/errors.js";

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: string;
  /**
   * Presente solo en tokens de propósito acotado (ej. `ensayo-stream`, que
   * autoriza reproducir UN video por 15 minutos). Un token de sesión nunca lo
   * lleva, y `authenticate` los rechaza: sin esa asimetría, un token acotado
   * filtrado por la URL de un `<video>` valdría como sesión completa.
   */
  typ?: string;
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
  } catch {
    throw unauthorized("Token inválido o expirado");
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
}

export function signToken(user: { id: string; email: string; name: string; role: string }) {
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
