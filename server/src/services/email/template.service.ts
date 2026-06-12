import type { EmailTemplateScope, Module, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { conflict, notFound } from "../../utils/errors.js";

export interface TemplateInput {
  key: string;
  nombre: string;
  descripcion?: string | null;
  modulo: Module;
  scope: EmailTemplateScope;
  toTemplate?: string;
  ccTemplate?: string;
  bccTemplate?: string;
  subjectTemplate: string;
  bodyTemplate: string;
  activo?: boolean;
}

export function listTemplates(filtros: { modulo?: Module; scope?: EmailTemplateScope; activo?: boolean }) {
  const where: Prisma.EmailTemplateWhereInput = {};
  if (filtros.modulo) where.modulo = filtros.modulo;
  if (filtros.scope) where.scope = filtros.scope;
  if (filtros.activo !== undefined) where.activo = filtros.activo;
  return prisma.emailTemplate.findMany({ where, orderBy: { nombre: "asc" } });
}

export async function getTemplate(id: string) {
  const tpl = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!tpl) throw notFound("TEMPLATE_NOT_FOUND", "Plantilla no encontrada");
  return tpl;
}

export async function getTemplateByKey(key: string) {
  const tpl = await prisma.emailTemplate.findUnique({ where: { key } });
  if (!tpl) throw notFound("TEMPLATE_NOT_FOUND", "Plantilla no encontrada");
  return tpl;
}

export async function createTemplate(input: TemplateInput) {
  const dup = await prisma.emailTemplate.findUnique({ where: { key: input.key } });
  if (dup) throw conflict("TEMPLATE_KEY_EXISTS", "Ya existe una plantilla con esa clave");
  // esSistema nunca se setea desde la API: solo las sembradas son de sistema.
  return prisma.emailTemplate.create({
    data: {
      key: input.key,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      modulo: input.modulo,
      scope: input.scope,
      toTemplate: input.toTemplate ?? "",
      ccTemplate: input.ccTemplate ?? "",
      bccTemplate: input.bccTemplate ?? "",
      subjectTemplate: input.subjectTemplate,
      bodyTemplate: input.bodyTemplate,
      activo: input.activo ?? true,
      esSistema: false,
    },
  });
}

export async function updateTemplate(id: string, input: Partial<TemplateInput>) {
  await getTemplate(id); // 404 si no existe
  // La key es estable: no se permite cambiarla (rompería la auto-selección).
  return prisma.emailTemplate.update({
    where: { id },
    data: {
      ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
      ...(input.descripcion !== undefined ? { descripcion: input.descripcion } : {}),
      ...(input.modulo !== undefined ? { modulo: input.modulo } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.toTemplate !== undefined ? { toTemplate: input.toTemplate } : {}),
      ...(input.ccTemplate !== undefined ? { ccTemplate: input.ccTemplate } : {}),
      ...(input.bccTemplate !== undefined ? { bccTemplate: input.bccTemplate } : {}),
      ...(input.subjectTemplate !== undefined ? { subjectTemplate: input.subjectTemplate } : {}),
      ...(input.bodyTemplate !== undefined ? { bodyTemplate: input.bodyTemplate } : {}),
      ...(input.activo !== undefined ? { activo: input.activo } : {}),
    },
  });
}

export async function deleteTemplate(id: string) {
  const tpl = await getTemplate(id);
  if (tpl.esSistema) {
    throw conflict("TEMPLATE_IS_SYSTEM", "No se puede borrar una plantilla de sistema");
  }
  await prisma.emailTemplate.delete({ where: { id } });
}
