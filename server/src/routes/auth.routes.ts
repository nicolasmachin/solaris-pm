import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { signToken } from "../middleware/auth.middleware.js";
import { badRequest, unauthorized } from "../utils/errors.js";

const loginSchema = z
  .object({
    email: z.string().email("Ingresá un email válido"),
    password: z.string().min(1, "La contraseña es obligatoria"),
  })
  .strict();

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request) => {
    if (!process.env.JWT_SECRET) {
      throw badRequest("JWT_NOT_CONFIGURED", "JWT_SECRET no está configurado");
    }

    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { role: { select: { name: true } } },
    });

    if (!user || user.deletedAt) {
      throw unauthorized("Credenciales inválidas");
    }

    const isValidPassword = await bcrypt.compare(body.password, user.password);
    if (!isValidPassword) {
      throw unauthorized("Credenciales inválidas");
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
    };
  });
}
