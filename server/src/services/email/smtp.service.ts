import nodemailer from "nodemailer";

import { prisma } from "../../lib/prisma.js";
import { badRequest } from "../../utils/errors.js";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "./crypto.js";

export interface SmtpConfigInput {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  fromName?: string | null;
  replyTo?: string | null;
}

// Vista segura: nunca expone la password, solo si existe.
export interface SmtpConfigView {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string | null;
  replyTo: string | null;
  hasPassword: boolean;
  verifiedAt: string | null;
}

interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName?: string | null;
  replyTo?: string | null;
}

function toView(cfg: {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string | null;
  replyTo: string | null;
  passwordEncrypted: string;
  verifiedAt: Date | null;
}): SmtpConfigView {
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    username: cfg.username,
    fromName: cfg.fromName,
    replyTo: cfg.replyTo,
    hasPassword: Boolean(cfg.passwordEncrypted),
    verifiedAt: cfg.verifiedAt ? cfg.verifiedAt.toISOString() : null,
  };
}

export async function getSmtpConfig(userId: string): Promise<SmtpConfigView | null> {
  const cfg = await prisma.userSmtpConfig.findUnique({ where: { userId } });
  return cfg ? toView(cfg) : null;
}

export async function upsertSmtpConfig(userId: string, input: SmtpConfigInput): Promise<SmtpConfigView> {
  if (!isEncryptionConfigured()) {
    throw badRequest("ENCRYPTION_NOT_CONFIGURED", "Falta SMTP_ENCRYPTION_KEY en el servidor");
  }
  const existing = await prisma.userSmtpConfig.findUnique({ where: { userId } });

  // Password: si viene, se cifra; si no viene pero ya había, se conserva; si no
  // viene y es la primera vez, es obligatoria.
  let passwordEncrypted: string;
  if (input.password) {
    passwordEncrypted = encryptSecret(input.password);
  } else if (existing) {
    passwordEncrypted = existing.passwordEncrypted;
  } else {
    throw badRequest("PASSWORD_REQUIRED", "Ingresá la contraseña la primera vez que configurás el SMTP");
  }

  // Si cambian datos de conexión, invalidamos la verificación previa.
  const cambioConexion =
    !existing ||
    existing.host !== input.host ||
    existing.port !== input.port ||
    existing.secure !== input.secure ||
    existing.username !== input.username ||
    Boolean(input.password);

  const data = {
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    passwordEncrypted,
    fromName: input.fromName ?? null,
    replyTo: input.replyTo ?? null,
    ...(cambioConexion ? { verifiedAt: null } : {}),
  };

  const saved = await prisma.userSmtpConfig.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return toView(saved);
}

// Devuelve las credenciales con la password en claro (para enviar). Lanza si el
// usuario no tiene SMTP configurado.
export async function getSmtpCredentials(userId: string): Promise<SmtpCredentials> {
  const cfg = await prisma.userSmtpConfig.findUnique({ where: { userId } });
  if (!cfg) throw badRequest("SMTP_NOT_CONFIGURED", "No tenés un servidor SMTP configurado");
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    username: cfg.username,
    password: decryptSecret(cfg.passwordEncrypted),
    fromName: cfg.fromName,
    replyTo: cfg.replyTo,
  };
}

export function buildTransporter(creds: SmtpCredentials) {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.username, pass: creds.password },
  });
}

// Normaliza errores SMTP de nodemailer a un código corto legible.
function normalizeSmtpError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  return e.code ?? (e.responseCode ? `SMTP_${e.responseCode}` : e.message ?? "UNKNOWN_ERROR");
}

// Prueba la conexión enviando un mail a la propia casilla. Si se pasan
// credenciales completas (con password) se usan esas; si no, la guardada.
export async function testSmtp(
  userId: string,
  input?: SmtpConfigInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let creds: SmtpCredentials;
  if (input?.password) {
    creds = {
      host: input.host,
      port: input.port,
      secure: input.secure,
      username: input.username,
      password: input.password,
      fromName: input.fromName,
      replyTo: input.replyTo,
    };
  } else {
    try {
      creds = await getSmtpCredentials(userId);
    } catch {
      return { ok: false, error: "SMTP_NOT_CONFIGURED" };
    }
  }

  try {
    const transporter = buildTransporter(creds);
    await transporter.verify();
    await transporter.sendMail({
      from: creds.fromName ? `${creds.fromName} <${creds.username}>` : creds.username,
      to: creds.username,
      subject: "Voltia PM — prueba de conexión SMTP",
      text: "Este es un mail de prueba de tu configuración SMTP en Voltia PM. Si lo recibís, ¡está todo OK!",
    });
    // Marcar verificada la config guardada (si existe una fila para el usuario).
    await prisma.userSmtpConfig
      .update({ where: { userId }, data: { verifiedAt: new Date() } })
      .catch(() => undefined);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: normalizeSmtpError(err) };
  }
}
