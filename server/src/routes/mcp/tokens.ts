// Emisión y verificación de los tokens del conector MCP.
//
// Los tres tipos de token llevan el campo `typ`, que `authenticate` rechaza
// (ver auth.middleware.ts): un token del conector nunca vale como sesión de la
// API, y una sesión de la API nunca vale contra /mcp. Es el mismo patrón que
// usa el streaming de videos.

import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  DOWNLOAD_TOKEN_TTL_SECONDS,
  MCP_ACCESS_TOKEN_TYPE,
  MCP_DOWNLOAD_TOKEN_TYPE,
  MCP_SCOPE,
  REFRESH_TOKEN_TTL_SECONDS,
  resourceUrl,
} from "./config.js";

// ── Hashing ────────────────────────────────────────────────────────────────

/**
 * Los códigos y refresh tokens se guardan hasheados: si alguien lee la base,
 * no se lleva credenciales usables. SHA-256 sin sal alcanza porque el material
 * es aleatorio de 256 bits, no una contraseña adivinable.
 */
function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function randomSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// ── PKCE ───────────────────────────────────────────────────────────────────

/**
 * Verifica un `code_verifier` contra el `code_challenge` guardado, con S256.
 * Es lo que impide que un código interceptado sirva sin el secreto que solo
 * tiene quien inició el flujo.
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Access token ───────────────────────────────────────────────────────────

interface McpAccessPayload {
  typ: string;
  sub: string;
  scope: string;
  /** A qué recurso aplica (RFC 8707). Evita reusar el token contra otro server. */
  aud: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign(
    { typ: MCP_ACCESS_TOKEN_TYPE, sub: userId, scope: MCP_SCOPE, aud: resourceUrl() },
    env.jwtSecret,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
}

/** Devuelve el userId, o null si el token no sirve. Nunca lanza. */
export function verifyAccessToken(token: string): string | null {
  let payload: McpAccessPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { audience: resourceUrl() }) as McpAccessPayload;
  } catch {
    return null;
  }
  if (payload.typ !== MCP_ACCESS_TOKEN_TYPE) return null;
  return payload.sub;
}

// ── Token de descarga ──────────────────────────────────────────────────────

interface McpDownloadPayload {
  typ: string;
  sub: string;
  /** Recurso concreto autorizado, ej. `proposal-version:<id>`. */
  res: string;
}

export function signDownloadToken(userId: string, resource: string): string {
  return jwt.sign({ typ: MCP_DOWNLOAD_TOKEN_TYPE, sub: userId, res: resource }, env.jwtSecret, {
    expiresIn: DOWNLOAD_TOKEN_TTL_SECONDS,
  });
}

/**
 * Valida un token de descarga contra el recurso pedido. El segundo chequeo es
 * el que importa: sin él, el token de un PDF serviría para bajar cualquier otro
 * conociendo su id.
 */
export function verifyDownloadToken(token: string, resource: string): string | null {
  let payload: McpDownloadPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as McpDownloadPayload;
  } catch {
    return null;
  }
  if (payload.typ !== MCP_DOWNLOAD_TOKEN_TYPE) return null;
  if (payload.res !== resource) return null;
  return payload.sub;
}

// ── Código de autorización ─────────────────────────────────────────────────

export async function issueAuthCode(params: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}): Promise<string> {
  const code = randomSecret();
  await prisma.mcpAuthCode.create({
    data: {
      codeHash: hashSecret(code),
      userId: params.userId,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scope: MCP_SCOPE,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
    },
  });
  return code;
}

export type AuthCodeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: string };

/**
 * Canjea un código: verifica que exista, no esté vencido ni usado, que el
 * redirect coincida y que el PKCE cierre. Lo marca usado en cualquier caso de
 * éxito — un código vale una sola vez.
 */
export async function consumeAuthCode(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<AuthCodeResult> {
  const row = await prisma.mcpAuthCode.findUnique({
    where: { codeHash: hashSecret(params.code) },
  });

  if (!row) return { ok: false, reason: "código inválido" };
  if (row.usedAt) return { ok: false, reason: "el código ya fue usado" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "el código venció" };
  if (row.redirectUri !== params.redirectUri) return { ok: false, reason: "redirect_uri no coincide" };
  if (!verifyPkce(params.codeVerifier, row.codeChallenge)) {
    return { ok: false, reason: "code_verifier no coincide" };
  }

  await prisma.mcpAuthCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, userId: row.userId };
}

// ── Refresh token ──────────────────────────────────────────────────────────

export async function issueRefreshToken(params: {
  userId: string;
  clientId: string;
}): Promise<string> {
  const token = randomSecret();
  await prisma.mcpRefreshToken.create({
    data: {
      tokenHash: hashSecret(token),
      userId: params.userId,
      clientId: params.clientId,
      scope: MCP_SCOPE,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  return token;
}

export type RefreshResult =
  | { ok: true; userId: string; refreshToken: string }
  | { ok: false; reason: string };

/**
 * Canjea un refresh token y lo rota: el viejo queda revocado y apuntando al
 * nuevo. La rotación la exige la spec para clientes públicos, y de paso deja
 * la cadena para detectar si alguien reusa uno viejo.
 */
export async function rotateRefreshToken(token: string): Promise<RefreshResult> {
  const row = await prisma.mcpRefreshToken.findUnique({
    where: { tokenHash: hashSecret(token) },
  });

  if (!row) return { ok: false, reason: "refresh token inválido" };
  if (row.revokedAt) return { ok: false, reason: "refresh token revocado" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "refresh token vencido" };

  const next = randomSecret();
  const created = await prisma.mcpRefreshToken.create({
    data: {
      tokenHash: hashSecret(next),
      userId: row.userId,
      clientId: row.clientId,
      scope: row.scope,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  await prisma.mcpRefreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date(), rotatedToId: created.id },
  });

  return { ok: true, userId: row.userId, refreshToken: next };
}

/** Corta el acceso del conector para un usuario. */
export async function revokeAllRefreshTokens(userId: string): Promise<number> {
  const result = await prisma.mcpRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
