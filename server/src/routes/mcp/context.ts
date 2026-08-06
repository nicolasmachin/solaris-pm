// Contexto de ejecución de una herramienta del conector.
//
// Toda herramienta actúa en nombre de un usuario real de Voltia PM: los
// permisos salen de su rol y la auditoría queda a su nombre. No hay usuario de
// servicio ni identidad de máquina.

import type { Action, Module } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { hasPermission } from "../../middleware/authorize.middleware.js";
import { isEmailAllowed } from "./config.js";

export interface McpUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Resuelve el usuario de un access token válido. Devuelve null si el usuario
 * fue dado de baja o si le sacaron el acceso al conector: el token vive una
 * hora, así que sin este chequeo una baja tardaría hasta ese tiempo en surtir
 * efecto.
 */
export async function resolveMcpUser(userId: string): Promise<McpUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      deletedAt: true,
      role: { select: { name: true } },
    },
  });

  if (!user || user.deletedAt) return null;
  if (!isEmailAllowed(user.email)) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role.name };
}

/**
 * Error de permisos de una herramienta. Se convierte en un resultado de error
 * legible en vez de una excepción, para que el chat pueda explicar qué faltó.
 */
export class McpPermissionError extends Error {
  constructor(module: Module, action: Action) {
    super(
      `No tenés permiso para esta acción (requiere ${action} en ${module}). ` +
        `Los permisos se administran desde Voltia PM, en Administración → Permisos.`,
    );
    this.name = "McpPermissionError";
  }
}

/**
 * Chequea un permiso de la matriz. Es la MISMA función que usan las rutas HTTP
 * (`hasPermission`), con su cache: el conector no tiene una vía paralela de
 * autorización, es una fachada sobre las reglas que ya existen.
 */
export async function requirePermission(
  user: McpUser,
  module: Module,
  action: Action,
): Promise<void> {
  const allowed = await hasPermission(user.role, module, action);
  if (!allowed) throw new McpPermissionError(module, action);
}
