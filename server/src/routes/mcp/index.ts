// Conector MCP: expone Voltia PM como herramientas dentro del chat de Claude.
//
// Se monta SIN el prefijo /api y SIN el hook `authenticate` que usa el resto
// de la aplicación, por dos motivos:
//
//  1. Los documentos de descubrimiento tienen que colgar de la raíz del
//     dominio (`/.well-known/...`), que es donde los busca Claude.
//  2. El conector trae su propia autenticación (OAuth con tokens `typ: "mcp"`),
//     y la pantalla de autorización tiene que ser accesible sin sesión previa.
//
// El patrón —preHandler explícito por ruta en lugar del hook global— es el
// mismo que usa videos.routes.ts para poder tener una ruta sin autenticar.

import type { FastifyInstance } from "fastify";

import { registerMcpDescargasRoutes } from "./descargas.routes.js";
import { registerMcpEndpoint } from "./mcp.routes.js";
import { registerMcpOauthRoutes } from "./oauth.routes.js";

export async function registerMcpRoutes(app: FastifyInstance) {
  await registerMcpOauthRoutes(app);
  await registerMcpEndpoint(app);
  await registerMcpDescargasRoutes(app);
}
