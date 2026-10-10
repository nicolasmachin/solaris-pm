/**
 * Agrega la subetapa "Presupuesto al instalador tercerizado" a Validación de
 * Operaciones (10-oct-2026).
 *
 *   docker compose exec server npx tsx prisma/scripts/add-subetapa-presupuesto-tercerizado.ts          # muestra qué haría
 *   docker compose exec server npx tsx prisma/scripts/add-subetapa-presupuesto-tercerizado.ts --apply  # aplica
 *
 * Hace tres cosas:
 *  1. La suma a la plantilla del pipeline guardada en settings (PIPELINE_TEMPLATE),
 *     si existe: sin eso, los proyectos nuevos no la crean, porque la plantilla
 *     guardada le gana al código.
 *  2. La crea en los proyectos con Validación de Operaciones todavía abierta.
 *     Las etapas ya completadas no se tocan: meterle una subetapa pendiente la
 *     reabriría.
 *
 *  3. Le da a GERENTE_OPERACIONES el permiso PAGOS_INSTALADOR:EDIT, que hoy solo
 *     significa "ver los pagos de todos los instaladores" (la gestión va con
 *     FINANZAS). Sin eso no ve el presupuesto: decisión de Nicolás, 10-oct-2026,
 *     lo ven el gerente de Operaciones, Finanzas y Admin. Reiniciar el server
 *     después (el authorize cachea 5 minutos).
 *
 * Idempotente: si ya está, no la vuelve a crear.
 */

import { Action, Module, PrismaClient, SettingKey, SettingLevel, StageStatus, StageType, SubstageStatus } from "@prisma/client";

import {
  getStageDefinition,
  PRESUPUESTO_MANO_DE_OBRA,
  type SubstageTemplate,
} from "../../src/services/pipeline-definitions.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const def = getStageDefinition(StageType.VALIDACION_OPERACIONES);
  const nueva = def?.substages.find((s) => s.name === PRESUPUESTO_MANO_DE_OBRA);
  if (!nueva) throw new Error("La subetapa no está en PIPELINE_DEFINITIONS");

  console.log(APPLY ? "== APLICANDO ==\n" : "== Simulación (agregá --apply para aplicar) ==\n");

  // 1. Plantilla guardada
  const setting = await prisma.setting.findFirst({
    where: { key: SettingKey.PIPELINE_TEMPLATE, level: SettingLevel.SYSTEM },
  });
  if (!setting?.value) {
    console.log("Plantilla guardada: no hay; se usa la del código.");
  } else {
    const parsed = JSON.parse(setting.value) as { stages?: Array<{ name: string; substages: SubstageTemplate[] }> };
    const etapa = parsed.stages?.find((s) => s.name === StageType.VALIDACION_OPERACIONES);
    if (!etapa) {
      console.log("Plantilla guardada: no tiene Validación de Operaciones; no se toca.");
    } else if (etapa.substages.some((s) => s.name === PRESUPUESTO_MANO_DE_OBRA)) {
      console.log("Plantilla guardada: ya la tiene.");
    } else {
      // Va después del informe del capataz y antes de confirmar la fecha.
      const informe = etapa.substages.find((s) => s.name === "Informe del capataz");
      const despuesDe = informe?.order ?? 1;
      for (const s of etapa.substages) if (s.order > despuesDe) s.order += 1;
      etapa.substages.push({ ...nueva, order: despuesDe + 1 });
      etapa.substages.sort((a, b) => a.order - b.order);
      console.log(`Plantilla guardada: se agrega en el orden ${despuesDe + 1}.`);
      if (APPLY) {
        await prisma.setting.update({ where: { id: setting.id }, data: { value: JSON.stringify(parsed) } });
      }
    }
  }

  // 2. Proyectos con la etapa abierta
  const etapas = await prisma.stage.findMany({
    where: {
      name: StageType.VALIDACION_OPERACIONES,
      status: { not: StageStatus.COMPLETED },
      project: { deletedAt: null },
    },
    select: {
      id: true,
      projectId: true,
      project: { select: { clientName: true } },
      substages: { select: { name: true, order: true } },
    },
  });

  let creadas = 0;
  for (const e of etapas) {
    if (e.substages.some((s) => s.name === PRESUPUESTO_MANO_DE_OBRA)) continue;
    // Al final: el orden es único por etapa y no se reordenan las existentes.
    const order = Math.max(0, ...e.substages.map((s) => s.order)) + 1;
    console.log(`  + ${e.project.clientName} (orden ${order})`);
    creadas++;
    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      const sub = await tx.substage.create({
        data: {
          projectId: e.projectId,
          stageId: e.id,
          order,
          name: nueva.name,
          status: SubstageStatus.PENDING,
          progressPercent: 0,
          sopCode: nueva.sopCode ?? null,
          responsableRol: nueva.responsableRol ?? null,
          responsible: nueva.responsible,
          isSystem: nueva.isSystem ?? true,
          isActive: nueva.isActive ?? true,
        },
      });
      if (nueva.checklist?.length) {
        await tx.checklistItem.createMany({
          data: nueva.checklist.map((it, idx) => ({
            substageId: sub.id,
            projectId: e.projectId,
            order: idx + 1,
            label: it.label,
            isRequired: it.isRequired ?? false,
          })),
        });
      }
    });
  }

  // 3. Permiso del gerente de Operaciones
  const rol = await prisma.role.findUnique({ where: { name: "GERENTE_OPERACIONES" } });
  if (!rol) {
    console.log("\nRol GERENTE_OPERACIONES: no existe; no se otorga el permiso.");
  } else {
    const ya = await prisma.permission.findUnique({
      where: { roleId_module_action: { roleId: rol.id, module: Module.PAGOS_INSTALADOR, action: Action.EDIT } },
    });
    console.log(`\nGERENTE_OPERACIONES:PAGOS_INSTALADOR:EDIT: ${ya ? "ya lo tiene" : APPLY ? "otorgado" : "a otorgar"}.`);
    if (!ya && APPLY) {
      await prisma.permission.create({
        data: { roleId: rol.id, module: Module.PAGOS_INSTALADOR, action: Action.EDIT },
      });
    }
  }

  console.log(`\nProyectos con Validación abierta: ${etapas.length} · subetapas ${APPLY ? "creadas" : "a crear"}: ${creadas}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
