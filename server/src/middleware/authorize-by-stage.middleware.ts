import { Action, Module, StageType } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { prisma } from "../lib/prisma.js";
import { forbidden, notFound, unauthorized } from "../utils/errors.js";
import { anyPermissionAllowed, authorizeAny, hasPermission } from "./authorize.middleware.js";

// Fuente ÚNICA de verdad del mapping etapa→módulo. Cada subetapa hereda su módulo
// de la etapa padre, y cada etapa lo deriva de su `name: StageType`.
// Ojo: el enum de etapas usa HABILITACION_UTE, el de módulos usa HABILITACION.
export const STAGE_TYPE_TO_MODULE: Record<StageType, Module> = {
  [StageType.ONBOARDING]: Module.ONBOARDING,
  [StageType.INGENIERIA]: Module.INGENIERIA,
  [StageType.OPERACIONES]: Module.OPERACIONES,
  [StageType.HABILITACION_UTE]: Module.HABILITACION,
  [StageType.POSTVENTA]: Module.POSTVENTA,
  // Pipeline expandido a 8 etapas (Traspasos v1). Ingeniería → PRE/FINAL,
  // Operaciones → CAPATAZ/COMPRAS/OBRA.
  [StageType.PRE_INGENIERIA]: Module.INGENIERIA,
  [StageType.REVISION_CAPATAZ]: Module.OPERACIONES,
  [StageType.VALIDACION_OPERACIONES]: Module.OPERACIONES,
  [StageType.INGENIERIA_FINAL]: Module.INGENIERIA,
  [StageType.COMPRAS]: Module.OPERACIONES,
  [StageType.EJECUCION_OBRA]: Module.OPERACIONES,
  [StageType.TRAMITACION_UTE]: Module.HABILITACION,
  [StageType.POST_HABILITACION]: Module.POSTVENTA,
};

// Módulos que componen el pipeline de un proyecto. Para endpoints que solo tienen
// :projectId (sin etapa puntual): alcanza con tener la acción en alguno.
export const PIPELINE_MODULES: Module[] = [
  Module.VENTAS,
  Module.ONBOARDING,
  Module.INGENIERIA,
  Module.OPERACIONES,
  Module.HABILITACION,
  Module.POSTVENTA,
];

// ─── Caches (TTL 10 min: cambian aún menos que los permisos) ──────────────────
const TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const stageModuleCache = new Map<string, CacheEntry<Module>>();
const substageStageCache = new Map<string, CacheEntry<string>>();
const taskContextCache = new Map<string, CacheEntry<TaskContext>>();

function getFresh<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  return undefined;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function clearStageModuleCache(): void {
  stageModuleCache.clear();
  substageStageCache.clear();
  taskContextCache.clear();
}

// ─── Resolución del módulo ────────────────────────────────────────────────────

// Stage → Module. null si la etapa no existe.
export async function getModuleByStageId(stageId: string): Promise<Module | null> {
  const cached = getFresh(stageModuleCache, stageId);
  if (cached) return cached;
  const stage = await prisma.stage.findUnique({ where: { id: stageId }, select: { name: true } });
  if (!stage) return null;
  const mod = STAGE_TYPE_TO_MODULE[stage.name];
  setCache(stageModuleCache, stageId, mod);
  return mod;
}

// Substage → Stage → Module. null si la subetapa no existe.
export async function getModuleBySubstageId(substageId: string): Promise<Module | null> {
  const cachedStageId = getFresh(substageStageCache, substageId);
  if (cachedStageId) return getModuleByStageId(cachedStageId);
  const sub = await prisma.substage.findUnique({ where: { id: substageId }, select: { stageId: true } });
  if (!sub) return null;
  setCache(substageStageCache, substageId, sub.stageId);
  return getModuleByStageId(sub.stageId);
}

export interface TaskContext {
  exists: boolean;
  module: Module | null; // null = task a nivel proyecto (sin etapa/subetapa)
}

// Task → (Substage → Stage) | Stage → Module. Distingue "no existe" (404) de
// "existe pero sin etapa" (module null → el caller aplica fallback de pipeline).
export async function getTaskContextById(taskId: string): Promise<TaskContext> {
  const cached = getFresh(taskContextCache, taskId);
  if (cached) return cached;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { substageId: true, stageId: true },
  });
  if (!task) return { exists: false, module: null };

  let module: Module | null = null;
  if (task.substageId) module = await getModuleBySubstageId(task.substageId);
  else if (task.stageId) module = await getModuleByStageId(task.stageId);

  const ctx: TaskContext = { exists: true, module };
  setCache(taskContextCache, taskId, ctx);
  return ctx;
}

// Compat con la spec/tests: módulo de una task (o null si no existe / sin etapa).
export async function getModuleByTaskId(taskId: string): Promise<Module | null> {
  return (await getTaskContextById(taskId)).module;
}

// ─── Middlewares ──────────────────────────────────────────────────────────────

// Resuelve el módulo desde los IDs en params (prioridad substage > stage > task)
// y aplica la lógica allow/forbidden idéntica a authorize(). 404 si el recurso no
// existe (no 403). Para tasks a nivel proyecto, fallback a "any pipeline".
export function authorizeByStageContext(action: Action) {
  return async function authorizeByStageContextRequest(request: FastifyRequest) {
    if (!request.user) throw unauthorized("No autenticado");
    const params = request.params as Record<string, string | undefined>;
    const role = request.user.role;

    let resolvedModule: Module | null = null;

    if (params.substageId) {
      resolvedModule = await getModuleBySubstageId(params.substageId);
      if (!resolvedModule) throw notFound("SUBSTAGE_NOT_FOUND", "Subetapa no encontrada");
    } else if (params.stageId) {
      resolvedModule = await getModuleByStageId(params.stageId);
      if (!resolvedModule) throw notFound("STAGE_NOT_FOUND", "Etapa no encontrada");
    } else if (params.taskId) {
      const ctx = await getTaskContextById(params.taskId);
      if (!ctx.exists) throw notFound("TASK_NOT_FOUND", "Tarea no encontrada");
      if (ctx.module) {
        resolvedModule = ctx.module;
      } else {
        // Task a nivel proyecto: alcanza con la acción en algún módulo del pipeline.
        const allowed = await anyPermissionAllowed(
          role,
          PIPELINE_MODULES.map((m) => ({ module: m, action })),
          hasPermission,
        );
        if (!allowed) throw forbidden("No tenés permiso para realizar esta acción");
        return;
      }
    } else {
      throw new Error("authorizeByStageContext requiere substageId, stageId o taskId en params");
    }

    const allowed = await hasPermission(role, resolvedModule, action);
    if (!allowed) throw forbidden("No tenés permiso para realizar esta acción");
  };
}

// Para endpoints con solo :projectId (sin etapa puntual): la acción en al menos
// uno de los módulos del pipeline. Reusa authorizeAny.
export function authorizeProjectEditAnyPipeline(action: Action) {
  return authorizeAny(PIPELINE_MODULES.map((m) => ({ module: m, action })));
}
