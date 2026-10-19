import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate, signToken } from "../middleware/auth.middleware.js";
import { AppError, badRequest, unauthorized } from "../utils/errors.js";

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

type MotivoFalla = "USUARIO_INEXISTENTE" | "CONTRASENA_INCORRECTA" | "USUARIO_DADO_DE_BAJA";

/**
 * Guarda un intento de login en `login_attempts`. Detrás de Caddy la IP real
 * viene en `x-forwarded-for`. Si falla el registro, el login sigue: auditar no
 * puede dejar a nadie afuera.
 */
async function registrarIntento(
  request: FastifyRequest,
  identifier: string,
  userId: string | null,
  reason: MotivoFalla | null,
) {
  const forwarded = request.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || request.ip;
  try {
    await prisma.loginAttempt.create({
      data: {
        identifier: identifier.trim().slice(0, 200),
        userId,
        success: reason === null,
        reason,
        ip,
        userAgent: request.headers["user-agent"]?.slice(0, 300) ?? null,
      },
    });
  } catch (err) {
    request.log.error({ err }, "No se pudo registrar el intento de login");
  }
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

    // Cada intento queda registrado (sin la contraseña) para poder auditar por
    // qué alguien no entra. Y el mensaje dice qué está mal: a pedido de
    // Dirección se prioriza que la persona sepa si erró el usuario o la
    // contraseña, aunque eso deje saber qué usuarios existen.
    if (!user) {
      await registrarIntento(request, body.email, null, "USUARIO_INEXISTENTE");
      throw new AppError(
        401,
        "USUARIO_INEXISTENTE",
        "No hay ningún usuario con ese nombre o email. Revisá cómo lo escribiste: va el email completo (por ejemplo nombre@voltia.com.uy) o tu usuario.",
      );
    }
    if (user.deletedAt) {
      await registrarIntento(request, body.email, user.id, "USUARIO_DADO_DE_BAJA");
      throw new AppError(
        401,
        "USUARIO_DADO_DE_BAJA",
        "Este usuario está dado de baja. Hablá con el administrador de Voltia PM.",
      );
    }

    const isValidPassword = await bcrypt.compare(body.password, user.password);
    if (!isValidPassword) {
      await registrarIntento(request, body.email, user.id, "CONTRASENA_INCORRECTA");
      throw new AppError(
        401,
        "CONTRASENA_INCORRECTA",
        "El usuario existe, pero la contraseña no es correcta. Revisá mayúsculas y que no se te haya autocompletado otra.",
      );
    }

    await registrarIntento(request, body.email, user.id, null);

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
