// Construcción del servidor MCP y registro de herramientas.
//
// Se arma uno por request (modo sin sesión): cada llamada trae su token, se
// resuelve el usuario, se responde y se cierra. Sin estado entre llamadas no
// hay sesiones que expirar ni memoria que se acumule, y el servidor puede
// reiniciarse sin cortarle la conexión a nadie.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { VERSION } from "./version.js";
import type { McpUser } from "./context.js";
import { registerDiagnosticTools } from "./tools/diagnostico.js";
import { registerPendientesTools } from "./tools/pendientes.js";
import { registerVentasTools } from "./tools/ventas.js";

/** Texto que ve el modelo sobre qué es este servidor. */
const INSTRUCTIONS = `Herramientas de Voltia PM, el sistema interno de gestión de
proyectos fotovoltaicos de Voltia (Uruguay).

Reglas de uso:
- Las acciones se ejecutan en nombre del usuario conectado y quedan auditadas.
- Antes de escribir sobre un cliente potencial, confirmá con el usuario cuál es
  si hay más de una coincidencia posible. No adivines.
- Los importes están en dólares salvo que se indique lo contrario.`;

export function buildMcpServer(user: McpUser): McpServer {
  const server = new McpServer(
    { name: "voltia-pm", version: VERSION },
    { instructions: INSTRUCTIONS },
  );

  registerDiagnosticTools(server, user);
  registerVentasTools(server, user);
  registerPendientesTools(server, user);

  return server;
}
