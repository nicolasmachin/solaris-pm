// Constantes y helpers de configuración del conector MCP.

import { env } from "../../config/env.js";

/** Ruta del endpoint MCP, relativa a la raíz del dominio. */
export const MCP_PATH = "/mcp";

/**
 * Identificador del recurso protegido. Tiene que ser IDÉNTICO a la URL que el
 * usuario tipea al agregar el conector, incluido el path: Claude compara los
 * dos strings y aborta si difieren (una barra final de más alcanza).
 */
export function resourceUrl(): string {
  return `${env.mcpPublicUrl.replace(/\/$/, "")}${MCP_PATH}`;
}

/** Emisor del OAuth: la raíz del dominio. */
export function issuerUrl(): string {
  return env.mcpPublicUrl.replace(/\/$/, "");
}

/**
 * Vida del access token. Corta porque no es revocable: es un JWT que se valida
 * por firma, así que quitarle el acceso a alguien tarda, como mucho, una hora.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

/** Vida del código de autorización. Se canjea de inmediato; 60 s sobra. */
export const AUTH_CODE_TTL_SECONDS = 60;

/** Vida del refresh token. Se rota en cada uso. */
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Vida de los enlaces de descarga que devuelven las herramientas. Alcanza para
 * abrir el PDF desde el celular y es corto para que un enlace que quede en el
 * historial del chat no sirva mucho después.
 */
export const DOWNLOAD_TOKEN_TTL_SECONDS = 15 * 60;

/** Tipo (`typ`) de cada token acotado. `authenticate` rechaza todos. */
export const MCP_ACCESS_TOKEN_TYPE = "mcp-access";
export const MCP_DOWNLOAD_TOKEN_TYPE = "mcp-download";

/** Único scope. Los permisos reales los decide la matriz, no el scope. */
export const MCP_SCOPE = "voltia";

/**
 * Redirecciones aceptadas al terminar la autorización.
 *
 * Es una allowlist explícita en vez de confiar en lo que declare el cliente:
 * el redirect_uri es a dónde viaja el código de autorización, así que aceptar
 * uno arbitrario es entregarle el acceso a quien lo pida.
 *
 * - Claude web, escritorio y celular usan un callback fijo.
 * - Claude Code corre en la máquina del usuario y usa un puerto local que
 *   cambia en cada sesión, así que ahí el puerto se ignora (RFC 8252).
 */
const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";

export function isAllowedRedirectUri(uri: string): boolean {
  if (uri === CLAUDE_CALLBACK) return true;

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  const isLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  return isLoopback && parsed.protocol === "http:" && parsed.pathname === "/callback";
}

/** ¿Este usuario está habilitado a conectar? */
export function isEmailAllowed(email: string): boolean {
  const allowed = env.mcpAllowedEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/** ¿El conector está configurado? Sin allowlist no habilita a nadie. */
export function isMcpEnabled(): boolean {
  return env.mcpAllowedEmails.trim().length > 0;
}

/**
 * A qué instalación está apuntando este servidor.
 *
 * No es cosmético. Producción y desarrollo son dos instalaciones con dos bases
 * distintas, y las herramientas se llaman igual en las dos: sin esta marca, ni
 * el modelo ni la persona pueden saber si un "creá el lead" fue a parar a la
 * base real o a una copia. Viaja en el nombre del servidor (que se ve en la
 * lista de conectores), en las instrucciones y en `estado_conexion`.
 */
export function esProduccion(): boolean {
  return env.nodeEnv === "production";
}

/** Etiqueta corta del entorno, para mostrarle a una persona. */
export function entornoLabel(): string {
  return esProduccion() ? "producción" : "desarrollo";
}
