import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { unauthorized } from "../utils/errors.js";

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
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
    },
  });

  if (!user) {
    throw unauthorized("El usuario del token no existe");
  }

  request.user = user;
}

export function signToken(user: { id: string; email: string; name: string }) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    },
  );
}
