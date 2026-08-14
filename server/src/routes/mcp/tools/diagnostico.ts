// Herramienta de diagnóstico del conector.
//
// Sirve para comprobar de punta a punta que la conexión funciona y con qué
// identidad: si algo falla, decir "probá `estado_conexion`" es más útil que
// pedirle a alguien que mire logs.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module } from "@prisma/client";

import { hasPermission } from "../../../middleware/authorize.middleware.js";
import { esProduccion, issuerUrl } from "../config.js";
import type { McpUser } from "../context.js";

/** Módulos que le importan al conector, para el resumen de permisos. */
const MODULES_DE_INTERES: Array<{ module: Module; actions: Action[] }> = [
  { module: Module.VENTAS, actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMMENT] },
  { module: Module.OPERACIONES, actions: [Action.VIEW, Action.COMMENT] },
  { module: Module.TRAMITES_UTE, actions: [Action.VIEW] },
  { module: Module.EXPERIENCIA_CLIENTES, actions: [Action.VIEW, Action.CREATE] },
];

export function registerDiagnosticTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "estado_conexion",
    {
      title: "Estado de la conexión",
      description:
        "Verifica que la conexión con Voltia PM funciona y muestra con qué usuario " +
        "está operando y qué puede hacer. Usar cuando el usuario pregunta si el " +
        "conector anda o por qué una herramienta devuelve un error de permisos.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      // Agrupado por módulo: con cuatro módulos, la lista plana de pares
      // módulo:acción se vuelve ilegible.
      const porModulo: string[] = [];
      for (const { module, actions } of MODULES_DE_INTERES) {
        const tiene: string[] = [];
        for (const action of actions) {
          if (await hasPermission(user.role, module, action)) tiene.push(action);
        }
        porModulo.push(`${module}: ${tiene.length > 0 ? tiene.join(", ") : "sin acceso"}`);
      }

      const lineas = [
        esProduccion()
          ? `Conexión con Voltia PM activa — PRODUCCIÓN (${issuerUrl()}).`
          : `Conexión con Voltia PM activa — entorno de DESARROLLO (${issuerUrl()}). ` +
            `No es la base real: lo que se cargue acá no lo ve el equipo.`,
        `Usuario: ${user.name} (${user.email})`,
        `Rol: ${user.role}`,
        "",
        "Permisos:",
        ...porModulo.map((l) => `- ${l}`),
      ];

      return { content: [{ type: "text" as const, text: lineas.join("\n") }] };
    },
  );
}
