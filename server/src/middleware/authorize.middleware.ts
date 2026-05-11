import type { Action, Module } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { forbidden, unauthorized } from "../utils/errors.js";

const PERMISSIONS_TTL_MS = 5 * 60 * 1000;

type PermissionCacheEntry = {
  allowed: boolean;
  expiresAt: number;
};

// Cache keyed por roleName + module + action. Se invalida vía clearPermissionCache()
// cuando se editan roles o se modifica la matriz de permisos.
const permissionsCache = new Map<string, PermissionCacheEntry>();

function buildCacheKey(roleName: string, module: Module, action: Action) {
  return `${roleName}:${module}:${action}`;
}

async function hasPermission(roleName: string, module: Module, action: Action) {
  const cacheKey = buildCacheKey(roleName, module, action);
  const cachedPermission = permissionsCache.get(cacheKey);

  if (cachedPermission && cachedPermission.expiresAt > Date.now()) {
    return cachedPermission.allowed;
  }

  const permission = await prisma.permission.findFirst({
    where: {
      module,
      action,
      role: { name: roleName },
    },
    select: { id: true },
  });

  const allowed = Boolean(permission);

  permissionsCache.set(cacheKey, {
    allowed,
    expiresAt: Date.now() + PERMISSIONS_TTL_MS,
  });

  return allowed;
}

export function clearPermissionCache() {
  permissionsCache.clear();
}

export function authorize(module: Module, action: Action) {
  return async function authorizeRequest(request: import("fastify").FastifyRequest) {
    if (!request.user) {
      throw unauthorized("No autenticado");
    }

    const allowed = await hasPermission(request.user.role, module, action);

    if (!allowed) {
      throw forbidden("No tenés permiso para realizar esta acción");
    }
  };
}

/**
 * Núcleo testeable de `authorizeAny`: dada una función de chequeo y la lista
 * de permisos, devuelve true si el usuario tiene AL MENOS UNO. Separado de la
 * versión integrada con prisma para poder testearlo sin DB.
 */
export async function anyPermissionAllowed(
  roleName: string,
  perms: Array<{ module: Module; action: Action }>,
  check: (role: string, module: Module, action: Action) => Promise<boolean>,
): Promise<boolean> {
  for (const p of perms) {
    if (await check(roleName, p.module, p.action)) return true;
  }
  return false;
}

/**
 * Permite el acceso si el usuario tiene AL MENOS UNO de los permisos listados.
 * Útil para recursos compartidos entre módulos (ej. la lista de materiales que
 * editan tanto INGENIERIA.EDIT como OPERACIONES.EDIT). Admin pasa por la vía
 * normal (su rol tiene los permisos en la matriz Permission).
 */
export function authorizeAny(perms: Array<{ module: Module; action: Action }>) {
  if (perms.length === 0) {
    throw new Error("authorizeAny requiere al menos un permiso");
  }
  return async function authorizeAnyRequest(request: import("fastify").FastifyRequest) {
    if (!request.user) {
      throw unauthorized("No autenticado");
    }

    const allowed = await anyPermissionAllowed(request.user.role, perms, hasPermission);
    if (!allowed) {
      throw forbidden("No tenés permiso para realizar esta acción");
    }
  };
}
