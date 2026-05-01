import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate, signToken } from "../middleware/auth.middleware.js";
import { badRequest, unauthorized } from "../utils/errors.js";

const loginSchema = z
  .object({
    email: z.string().email("Ingresá un email válido"),
    password: z.string().min(1, "La contraseña es obligatoria"),
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresá la contraseña actual"),
    newPassword: z.string().min(8, "La contraseña nueva debe tener al menos 8 caracteres"),
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
        passwordTemporary: user.passwordTemporary,
      },
    };
  });

  // Cambiar contraseña: cualquier usuario logueado puede hacerlo. Si tenía
  // `passwordTemporary=true`, el flag se baja al setear una nueva.
  app.post("/auth/change-password", { preHandler: authenticate }, async (request) => {
    const body = changePasswordSchema.parse(request.body);
    const userId = request.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw unauthorized("Usuario no válido");

    const isValid = await bcrypt.compare(body.currentPassword, user.password);
    if (!isValid) throw unauthorized("Contraseña actual incorrecta");

    const hashed = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, passwordTemporary: false },
    });

    return { success: true };
  });
}
