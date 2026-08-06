// Servidor de autorización OAuth 2.1 del conector MCP.
//
// Implementa lo mínimo que Claude necesita para conectarse: los dos documentos
// de descubrimiento, la pantalla de autorización y el canje de tokens. No hay
// registro dinámico de clientes (`/register`): el redirect_uri se valida contra
// una allowlist, que es más estricto que confiar en lo que declare el cliente.

import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../lib/prisma.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  isEmailAllowed,
  isAllowedRedirectUri,
  isMcpEnabled,
  issuerUrl,
  MCP_PATH,
  MCP_SCOPE,
  resourceUrl,
} from "./config.js";
import { renderConsentPage } from "./consent.page.js";
import { clearAttempts, tooManyAttempts } from "./rate-limit.js";
import {
  consumeAuthCode,
  issueAuthCode,
  issueRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "./tokens.js";

/** Error con la forma que exige OAuth (RFC 6749). Claude lee el `error`. */
function oauthError(reply: FastifyReply, status: number, code: string, description: string) {
  return reply.code(status).send({ error: code, error_description: description });
}

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export async function registerMcpOauthRoutes(app: FastifyInstance) {
  // El endpoint de token recibe `application/x-www-form-urlencoded` (lo exige
  // RFC 6749) y Fastify sólo parsea JSON por defecto. Sin esto, Claude recibe
  // un 415 y la conexión falla sin explicación visible.
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        const params = new URLSearchParams(body as string);
        done(null, Object.fromEntries(params.entries()));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  // ── Descubrimiento ───────────────────────────────────────────────────────

  /**
   * Metadata del recurso protegido (RFC 9728). El campo `resource` tiene que
   * coincidir EXACTO con la URL que el usuario tipea al agregar el conector.
   */
  app.get("/.well-known/oauth-protected-resource", async () => ({
    resource: resourceUrl(),
    authorization_servers: [issuerUrl()],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
  }));

  // Claude también prueba esta variante, con el path del MCP colgando de la
  // ruta well-known, antes de caer a la anterior.
  app.get(`/.well-known/oauth-protected-resource${MCP_PATH}`, async () => ({
    resource: resourceUrl(),
    authorization_servers: [issuerUrl()],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
  }));

  /**
   * Metadata del servidor de autorización (RFC 8414).
   *
   * `code_challenge_methods_supported` es obligatorio: Claude manda PKCE S256
   * siempre y verifica acá que el servidor lo soporte antes de empezar.
   */
  const authServerMetadata = () => ({
    issuer: issuerUrl(),
    authorization_endpoint: `${issuerUrl()}/oauth/authorize`,
    token_endpoint: `${issuerUrl()}/oauth/token`,
    scopes_supported: [MCP_SCOPE, "offline_access"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    // Cliente público: no hay secreto que autenticar en /token.
    token_endpoint_auth_methods_supported: ["none"],
    // Permite que Claude se identifique con su propio documento de cliente en
    // vez de registrarse dinámicamente.
    client_id_metadata_document_supported: true,
  });

  app.get("/.well-known/oauth-authorization-server", async () => authServerMetadata());
  app.get(`/.well-known/oauth-authorization-server${MCP_PATH}`, async () => authServerMetadata());

  // ── Autorización ─────────────────────────────────────────────────────────

  app.get("/oauth/authorize", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, unknown>;
    const clientId = firstString(query.client_id);
    const redirectUri = firstString(query.redirect_uri);
    const responseType = firstString(query.response_type);
    const codeChallenge = firstString(query.code_challenge);
    const codeChallengeMethod = firstString(query.code_challenge_method);
    const state = firstString(query.state);

    if (!isMcpEnabled()) {
      return oauthError(reply, 503, "temporarily_unavailable", "El conector no está habilitado");
    }
    // El redirect se valida ANTES que nada: si no es de confianza, no se
    // redirige el error tampoco — se muestra acá.
    if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
      return oauthError(reply, 400, "invalid_request", "redirect_uri no permitido");
    }
    if (!clientId) {
      return oauthError(reply, 400, "invalid_request", "Falta client_id");
    }
    if (responseType !== "code") {
      return oauthError(reply, 400, "unsupported_response_type", "Sólo se soporta response_type=code");
    }
    if (!codeChallenge || codeChallengeMethod !== "S256") {
      return oauthError(reply, 400, "invalid_request", "Se requiere PKCE con S256");
    }

    return reply
      .type("text/html; charset=utf-8")
      .send(renderConsentPage({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }));
  });

  app.post("/oauth/authorize", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const clientId = firstString(body.client_id);
    const redirectUri = firstString(body.redirect_uri);
    const state = firstString(body.state);
    const codeChallenge = firstString(body.code_challenge);
    const codeChallengeMethod = firstString(body.code_challenge_method);
    const email = firstString(body.email).trim();
    const password = firstString(body.password);

    if (!isMcpEnabled()) {
      return oauthError(reply, 503, "temporarily_unavailable", "El conector no está habilitado");
    }
    if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
      return oauthError(reply, 400, "invalid_request", "redirect_uri no permitido");
    }
    if (!codeChallenge || codeChallengeMethod !== "S256") {
      return oauthError(reply, 400, "invalid_request", "Se requiere PKCE con S256");
    }

    const rerender = (error: string) =>
      reply.type("text/html; charset=utf-8").send(
        renderConsentPage({
          clientId,
          redirectUri,
          state,
          codeChallenge,
          codeChallengeMethod,
          error,
          email,
        }),
      );

    const rateKey = `${request.ip}:${email.toLowerCase()}`;
    if (tooManyAttempts(rateKey)) {
      return rerender("Demasiados intentos. Esperá unos minutos y probá de nuevo.");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, deletedAt: true, passwordTemporary: true },
    });

    // Mismo mensaje para usuario inexistente y contraseña incorrecta: decir
    // cuál de las dos falló confirma qué emails existen.
    if (!user || user.deletedAt || !(await bcrypt.compare(password, user.password))) {
      return rerender("Email o contraseña incorrectos.");
    }

    // La allowlist se chequea DESPUÉS de validar la contraseña: si no, la
    // pantalla revelaría quién está habilitado sin necesidad de credenciales.
    if (!isEmailAllowed(user.email)) {
      return rerender("Tu usuario no está habilitado para conectar Voltia PM con Claude.");
    }

    // Con contraseña temporal no se autoriza: el conector quedaría atado a una
    // credencial que la app misma está obligando a cambiar.
    if (user.passwordTemporary) {
      return rerender("Primero entrá a Voltia PM y cambiá tu contraseña temporal.");
    }

    clearAttempts(rateKey);

    const code = await issueAuthCode({
      userId: user.id,
      clientId,
      redirectUri,
      codeChallenge,
    });

    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);

    return reply.redirect(target.toString(), 302);
  });

  // ── Canje de tokens ──────────────────────────────────────────────────────

  app.post("/oauth/token", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const grantType = firstString(body.grant_type);

    if (grantType === "authorization_code") {
      const code = firstString(body.code);
      const redirectUri = firstString(body.redirect_uri);
      const codeVerifier = firstString(body.code_verifier);
      const clientId = firstString(body.client_id);

      if (!code || !redirectUri || !codeVerifier) {
        return oauthError(reply, 400, "invalid_request", "Faltan parámetros del canje");
      }

      const result = await consumeAuthCode({ code, redirectUri, codeVerifier });
      if (!result.ok) {
        // `invalid_grant` es el código que Claude espera para reintentar el
        // flujo desde cero. Uno propio lo deja colgado.
        return oauthError(reply, 400, "invalid_grant", result.reason);
      }

      const refreshToken = await issueRefreshToken({ userId: result.userId, clientId });
      return reply.send({
        access_token: signAccessToken(result.userId),
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: refreshToken,
        scope: MCP_SCOPE,
      });
    }

    if (grantType === "refresh_token") {
      const token = firstString(body.refresh_token);
      if (!token) {
        return oauthError(reply, 400, "invalid_request", "Falta refresh_token");
      }

      const result = await rotateRefreshToken(token);
      if (!result.ok) {
        return oauthError(reply, 400, "invalid_grant", result.reason);
      }

      // El usuario puede haberse dado de baja o perdido el permiso desde que
      // se emitió el token: se revalida en cada refresh.
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { email: true, deletedAt: true },
      });
      if (!user || user.deletedAt || !isEmailAllowed(user.email)) {
        return oauthError(reply, 400, "invalid_grant", "El usuario ya no está habilitado");
      }

      return reply.send({
        access_token: signAccessToken(result.userId),
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: result.refreshToken,
        scope: MCP_SCOPE,
      });
    }

    return oauthError(reply, 400, "unsupported_grant_type", `grant_type no soportado: ${grantType}`);
  });
}
