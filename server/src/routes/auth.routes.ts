import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate, signToken } from "../middleware/auth.middleware.js";
import { sendEmail } from "../services/email.service.js";
import { registrarIntento } from "../services/login-attempts.service.js";
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

const pedirCodigoSchema = z
  .object({ email: z.string().trim().min(1, "Ingresá tu usuario o tu email") })
  .strict();

const verificarCodigoSchema = z
  .object({
    email: z.string().trim().min(1, "Ingresá tu usuario o tu email"),
    code: z.string().trim().regex(/^\d{6}$/, "El código son 6 números"),
  })
  .strict();

/** Cuánto dura un código, cuántas veces se puede errar y cuántos se mandan por cuarto de hora. */
const CODIGO_MINUTOS = 10;
const CODIGO_MAX_INTENTOS = 5;
const CODIGOS_POR_15_MIN = 3;

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

// Los mensajes dicen qué está mal: a pedido de Dirección se prioriza que la
// persona sepa si erró el usuario o la contraseña, aunque eso deje saber qué
// usuarios existen.
function usuarioInexistente() {
  return new AppError(
    401,
    "USUARIO_INEXISTENTE",
    "No hay ningún usuario con ese nombre o email. Revisá cómo lo escribiste: va el email completo (por ejemplo nombre@voltia.com.uy) o tu usuario.",
  );
}
function usuarioDadoDeBaja() {
  return new AppError(
    401,
    "USUARIO_DADO_DE_BAJA",
    "Este usuario está dado de baja. Hablá con el administrador de Voltia PM.",
  );
}

type UsuarioConRol = NonNullable<Awaited<ReturnType<typeof buscarPorIdentificador>>>;

function respuestaDeIngreso(user: UsuarioConRol) {
  return {
    token: signToken({ id: user.id, email: user.email, name: user.name, role: user.role.name }),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      passwordTemporary: user.passwordTemporary,
    },
  };
}

function hashCodigo(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
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
    const intento = { identifier: body.email, method: "CONTRASENA" as const };

    if (!user) {
      await registrarIntento(request, { ...intento, userId: null, reason: "USUARIO_INEXISTENTE" });
      throw usuarioInexistente();
    }
    if (user.deletedAt) {
      await registrarIntento(request, { ...intento, userId: user.id, reason: "USUARIO_DADO_DE_BAJA" });
      throw usuarioDadoDeBaja();
    }

    const isValidPassword = await bcrypt.compare(body.password, user.password);
    if (!isValidPassword) {
      await registrarIntento(request, { ...intento, userId: user.id, reason: "CONTRASENA_INCORRECTA" });
      throw new AppError(
        401,
        "CONTRASENA_INCORRECTA",
        "El usuario existe, pero la contraseña no es correcta. Revisá mayúsculas y que no se te haya autocompletado otra.",
      );
    }

    await registrarIntento(request, { ...intento, userId: user.id, reason: null });
    return respuestaDeIngreso(user);
  });

  // Entrar sin contraseña, paso 1: manda un código de 6 números al mail del
  // usuario. Sirve para el equipo y para los clientes del portal. No crea
  // usuarios: solo funciona con uno que ya dio de alta el administrador.
  app.post("/auth/login-code/request", async (request) => {
    const body = pedirCodigoSchema.parse(request.body);
    const user = await buscarPorIdentificador(body.email);
    const intento = { identifier: body.email, method: "CODIGO_MAIL" as const };

    if (!user) {
      await registrarIntento(request, { ...intento, userId: null, reason: "USUARIO_INEXISTENTE" });
      throw usuarioInexistente();
    }
    if (user.deletedAt) {
      await registrarIntento(request, { ...intento, userId: user.id, reason: "USUARIO_DADO_DE_BAJA" });
      throw usuarioDadoDeBaja();
    }
    if (!user.email) {
      await registrarIntento(request, { ...intento, userId: user.id, reason: "USUARIO_SIN_EMAIL" });
      throw badRequest(
        "USUARIO_SIN_EMAIL",
        "Este usuario no tiene un mail cargado, así que no se le puede mandar un código. Entrá con tu contraseña o pedile al administrador que te cargue el mail.",
      );
    }

    const recientes = await prisma.loginCode.count({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    });
    if (recientes >= CODIGOS_POR_15_MIN) {
      throw new AppError(
        429,
        "DEMASIADOS_CODIGOS",
        "Ya se mandaron varios códigos en los últimos minutos. Revisá tu mail (también la carpeta de spam) o esperá un rato antes de pedir otro.",
      );
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    // Pedir un código nuevo anula los anteriores: vale solo el último que llegó.
    await prisma.loginCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.loginCode.create({
      data: {
        userId: user.id,
        codeHash: hashCodigo(code),
        expiresAt: new Date(Date.now() + CODIGO_MINUTOS * 60 * 1000),
      },
    });

    const enviado = await sendEmail({
      to: user.email,
      subject: `Tu código para entrar a Voltia: ${code}`,
      html: `<p>Hola ${user.name.split(" ")[0]},</p>
<p>Tu código para entrar es:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p>Vence en ${CODIGO_MINUTOS} minutos y sirve una sola vez.</p>
<p>Si no lo pediste vos, ignorá este mail: sin el código nadie puede entrar.</p>`,
      text: `Tu código para entrar a Voltia es ${code}. Vence en ${CODIGO_MINUTOS} minutos.`,
    });
    if (!enviado && process.env.NODE_ENV !== "production") {
      // En desarrollo el mail no sale: el código se muestra en el log para probar.
      request.log.info(`[login-code] código de desarrollo para ${user.email}: ${code}`);
    }
    if (!enviado && process.env.NODE_ENV === "production") {
      throw new AppError(
        502,
        "MAIL_NO_ENVIADO",
        "No se pudo mandar el mail con el código. Probá de nuevo en unos minutos o entrá con tu contraseña.",
      );
    }

    // Se muestra el mail parcialmente tapado, para que la persona sepa a dónde mirar.
    const [local, dominio] = user.email.split("@");
    const tapado = `${local.slice(0, 2)}${"•".repeat(Math.max(local.length - 2, 1))}@${dominio}`;
    return { sentTo: tapado, minutes: CODIGO_MINUTOS };
  });

  // Entrar sin contraseña, paso 2: con el código correcto entra igual que con la contraseña.
  app.post("/auth/login-code/verify", async (request) => {
    const body = verificarCodigoSchema.parse(request.body);
    const user = await buscarPorIdentificador(body.email);
    const intento = { identifier: body.email, method: "CODIGO_MAIL" as const };

    if (!user) {
      await registrarIntento(request, { ...intento, userId: null, reason: "USUARIO_INEXISTENTE" });
      throw usuarioInexistente();
    }
    if (user.deletedAt) {
      await registrarIntento(request, { ...intento, userId: user.id, reason: "USUARIO_DADO_DE_BAJA" });
      throw usuarioDadoDeBaja();
    }

    const pendiente = await prisma.loginCode.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!pendiente || pendiente.expiresAt < new Date() || pendiente.attempts >= CODIGO_MAX_INTENTOS) {
      await registrarIntento(request, { ...intento, userId: user.id, reason: "CODIGO_VENCIDO" });
      throw new AppError(
        401,
        "CODIGO_VENCIDO",
        "Ese código ya no sirve: venció, ya se usó o se erró demasiadas veces. Pedí uno nuevo.",
      );
    }

    const coincide = crypto.timingSafeEqual(
      Buffer.from(pendiente.codeHash, "hex"),
      Buffer.from(hashCodigo(body.code), "hex"),
    );
    if (!coincide) {
      const intentos = pendiente.attempts + 1;
      await prisma.loginCode.update({ where: { id: pendiente.id }, data: { attempts: intentos } });
      await registrarIntento(request, { ...intento, userId: user.id, reason: "CODIGO_INCORRECTO" });
      const quedan = CODIGO_MAX_INTENTOS - intentos;
      throw new AppError(
        401,
        "CODIGO_INCORRECTO",
        quedan > 0
          ? `El código no es correcto. Te ${quedan === 1 ? "queda 1 intento" : `quedan ${quedan} intentos`}.`
          : "El código no es correcto y ya no quedan intentos. Pedí uno nuevo.",
      );
    }

    await prisma.loginCode.update({ where: { id: pendiente.id }, data: { usedAt: new Date() } });
    await registrarIntento(request, { ...intento, userId: user.id, reason: null });
    return respuestaDeIngreso(user);
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

    // 400 y no 401: un 401 hace que la app cierre la sesión, y errar la
    // contraseña actual no tiene por qué sacar a nadie.
    const isValid = await bcrypt.compare(body.currentPassword, user.password);
    if (!isValid) throw badRequest("CONTRASENA_ACTUAL_INCORRECTA", "La contraseña actual no es correcta");

    const hashed = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, passwordTemporary: false },
    });

    return { success: true };
  });
}
