import type { Action, Module, Role } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { forbidden, unauthorized } from "../utils/errors.js";

const PERMISSIONS_TTL_MS = 5 * 60 * 1000;

type PermissionCacheEntry = {
  allowed: boolean;
  expiresAt: number;
};

const permissionsCache = new Map<string, PermissionCacheEntry>();

function buildCacheKey(role: Role, module: Module, action: Action) {
  return `${role}:${module}:${action}`;
}

async function hasPermission(role: Role, module: Module, action: Action) {
  const cacheKey = buildCacheKey(role, module, action);
  const cachedPermission = permissionsCache.get(cacheKey);

  if (cachedPermission && cachedPermission.expiresAt > Date.now()) {
    return cachedPermission.allowed;
  }

  const permission = await prisma.permission.findUnique({
    where: {
      role_module_action: {
        role,
        module,
        action,
      },
    },
    select: {
      id: true,
    },
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
