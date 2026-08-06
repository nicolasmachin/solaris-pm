// Herramienta de diagnóstico del conector.
//
// Sirve para comprobar de punta a punta que la conexión funciona y con qué
// identidad: si algo falla, decir "probá `estado_conexion`" es más útil que
// pedirle a alguien que mire logs.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module } from "@prisma/client";

import { hasPermission } from "../../../middleware/authorize.middleware.js";
import type { McpUser } from "../context.js";

/** Módulos que le importan al conector, para el resumen de permisos. */
const MODULES_DE_INTERES: Array<{ module: Module; actions: Action[] }> = [
  { module: Module.VENTAS, actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMMENT] },
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
      const permisos: string[] = [];
      for (const { module, actions } of MODULES_DE_INTERES) {
        for (const action of actions) {
          if (await hasPermission(user.role, module, action)) {
            permisos.push(`${module}:${action}`);
          }
        }
      }

      const lineas = [
        "Conexión con Voltia PM activa.",
        `Usuario: ${user.name} (${user.email})`,
        `Rol: ${user.role}`,
        permisos.length > 0
          ? `Permisos de ventas: ${permisos.join(", ")}`
          : "Sin permisos de ventas. Las herramientas de ventas van a fallar.",
      ];

      return { content: [{ type: "text" as const, text: lineas.join("\n") }] };
    },
  );
}
