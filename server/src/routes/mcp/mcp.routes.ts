// Endpoint del conector MCP.
//
// Modo sin sesión: cada request trae su token, se arma un servidor y un
// transporte, se responde y se cierra todo. Es más simple que mantener
// sesiones y sobrevive a un reinicio del servidor sin cortarle nada a nadie.

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { MCP_PATH, issuerUrl } from "./config.js";
import { resolveMcpUser } from "./context.js";
import { buildMcpServer } from "./server.js";
import { verifyAccessToken } from "./tokens.js";

/**
 * Respuesta a un pedido sin credenciales válidas.
 *
 * El 401 con `WWW-Authenticate` es lo que le dice a Claude dónde buscar la
 * metadata para arrancar el OAuth. Tiene que ser 401: en un 200 el header se
 * ignora, y la conexión falla con un "no se pudo alcanzar el servidor" que no
 * explica nada.
 */
function unauthorizedMcp(reply: FastifyReply) {
  const metadataUrl = `${issuerUrl()}/.well-known/oauth-protected-resource`;
  return reply
    .code(401)
    .header("WWW-Authenticate", `Bearer resource_metadata="${metadataUrl}"`)
    .send({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Autorización requerida" },
      id: null,
    });
}

function bearerFrom(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export async function registerMcpEndpoint(app: FastifyInstance) {
  app.post(MCP_PATH, async (request: FastifyRequest, reply: FastifyReply) => {
    const token = bearerFrom(request);
    if (!token) return unauthorizedMcp(reply);

    const userId = verifyAccessToken(token);
    if (!userId) return unauthorizedMcp(reply);

    // El usuario se revalida contra la base en cada llamada: una baja o una
    // salida de la allowlist tiene efecto inmediato, sin esperar a que venza
    // el token.
    const user = await resolveMcpUser(userId);
    if (!user) return unauthorizedMcp(reply);

    const server = buildMcpServer(user);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    // Fastify ya tomó el control de la respuesta; a partir de acá la maneja el
    // transporte sobre el stream crudo.
    reply.hijack();

    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      // El body ya viene parseado por Fastify: se lo pasamos para que el
      // transporte no intente leer un stream ya consumido.
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      request.log.error({ err: error }, "Falló una llamada al conector MCP");
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "Content-Type": "application/json" });
        reply.raw.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Error interno del conector" },
            id: null,
          }),
        );
      }
    }
  });

  // Sin sesión no hay stream de servidor a cliente ni sesión que cerrar. Se
  // responde explícitamente para que el cliente no quede esperando.
  const methodNotAllowed = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!bearerFrom(request)) return unauthorizedMcp(reply);
    return reply.code(405).header("Allow", "POST").send({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Este conector sólo acepta POST" },
      id: null,
    });
  };

  app.get(MCP_PATH, methodNotAllowed);
  app.delete(MCP_PATH, methodNotAllowed);
}
