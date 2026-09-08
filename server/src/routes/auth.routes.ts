import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate, signToken } from "../middleware/auth.middleware.js";
import { badRequest, unauthorized } from "../utils/errors.js";

// El campo se sigue llamando `email` por compatibilidad con el cliente y con
// cualquier integración vieja, pero acepta las dos cosas: el mail completo o el
// alias corto (`username`). No se valida como email justamente por eso.
const loginSchema = z
  .object({
    email: z.string().trim().min(1, "Ingresá tu usuario o tu email"),
    password: z.string().min(1, "La contraseña es obligatoria"),
  })
  .strict();

/**
 * Busca al usuario por mail o por alias, sin distinguir mayúsculas. Los dos
 * campos se guardan normalizados en minúsculas, así que alcanza con bajar lo que
 * escribió la persona.
 *
 * Un identificador nunca puede resolver dos usuarios: `email` y `username` son
 * únicos cada uno, y al crear un usuario se verifica que el alias no choque con
 * el mail de otro ni al revés (ver `normalizarIdentificador`).
 */
async function buscarPorIdentificador(raw: string) {
  const id = raw.trim().toLowerCase();
  return prisma.user.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
    include: { role: { select: { name: true } } },
  });
}

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
    const user = await buscarPorIdentificador(body.email);

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
