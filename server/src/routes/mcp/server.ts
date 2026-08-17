// Construcción del servidor MCP y registro de herramientas.
//
// Se arma uno por request (modo sin sesión): cada llamada trae su token, se
// resuelve el usuario, se responde y se cierra. Sin estado entre llamadas no
// hay sesiones que expirar ni memoria que se acumule, y el servidor puede
// reiniciarse sin cortarle la conexión a nadie.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { entornoLabel, esProduccion, issuerUrl } from "./config.js";
import { VERSION } from "./version.js";
import type { McpUser } from "./context.js";
import { registerDiagnosticTools } from "./tools/diagnostico.js";
import { registerExperienciaSolarTools } from "./tools/experiencia-solar.js";
import { registerMiDiaTools } from "./tools/mi-dia.js";
import { registerMinutaTools } from "./tools/minuta.js";
import { registerPendientesTools } from "./tools/pendientes.js";
import { registerPropuestaTools } from "./tools/propuesta.js";
import { registerProyectosTools } from "./tools/proyectos.js";
import { registerVentasTools } from "./tools/ventas.js";

/** Texto que ve el modelo sobre qué es este servidor. */
function instructions(): string {
  // El entorno va primero y en mayúsculas cuando NO es producción: es la única
  // señal que distingue una instalación de la otra, porque las herramientas se
  // llaman igual en las dos.
  const aviso = esProduccion()
    ? `Esta conexión apunta a PRODUCCIÓN (${issuerUrl()}): todo lo que se cree o
modifique es real y lo ve el equipo.`
    : `⚠️ Esta conexión apunta a un entorno de DESARROLLO (${issuerUrl()}), NO a
producción. Los datos son una copia: lo que se cargue acá no lo ve el equipo y
puede desaparecer. Aclarale esto al usuario si te pide cargar algo real.`;

  return `Herramientas de Voltia PM, el sistema interno de gestión de proyectos
fotovoltaicos de Voltia (Uruguay).

${aviso}

Reglas de uso:
- Las acciones se ejecutan en nombre del usuario conectado y quedan auditadas.
- Antes de escribir sobre un cliente potencial, confirmá con el usuario cuál es
  si hay más de una coincidencia posible. No adivines.
- Los importes están en dólares salvo que se indique lo contrario.`;
}

export function buildMcpServer(user: McpUser): McpServer {
  const server = new McpServer(
    // El nombre se ve en la lista de conectores del usuario. Con el sufijo, dos
    // conectores agregados a la vez se distinguen de un vistazo.
    { name: esProduccion() ? "voltia-pm" : `voltia-pm (${entornoLabel()})`, version: VERSION },
    { instructions: instructions() },
  );

  registerDiagnosticTools(server, user);
  registerMiDiaTools(server, user);
  registerVentasTools(server, user);
  registerMinutaTools(server, user);
  registerPropuestaTools(server, user);
  registerPendientesTools(server, user);
  registerProyectosTools(server, user);
  registerExperienciaSolarTools(server, user);

  return server;
}
