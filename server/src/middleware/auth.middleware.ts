import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { unauthorized } from "../utils/errors.js";

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: string;
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

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
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
    role: user.role,
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
