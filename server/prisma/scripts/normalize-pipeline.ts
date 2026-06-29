// Backfill del pipeline: completa la etapa POSTVENTA (Post-Habilitación) y marca
// COMPLETED los proyectos cuyo trámite UTE YA está finalizado pero el pipeline no
// avanzó (situación previa a la Tanda B). Aplica EXACTAMENTE la misma lógica que
// el auto-avance en vivo, reusando advancePostventaOnUteFinalizado — no la
// duplica, así no hay forma de que diverjan.
//
// Idempotente y prod-safe: DRY-RUN por defecto (no escribe); escribe sólo con
// --apply. Si un proyecto ya está en buen estado, se saltea.
//
// "Afectado" = robusto: al menos un UteProcess no borrado finalizado
// (currentStage FINALIZADO o finalizedAt presente) + etapa POSTVENTA en PENDING +
// proyecto no COMPLETED/ARCHIVED. Misma condición que la query del PASO 0.
//
// Fecha de cierre en cascada (igual que el auto-avance): finalizedAt ??
// HABILITACION_UTE.actualEndDate ?? OPERACIONES.actualEndDate. Si las tres son
// null, NO usa la fecha de hoy: lo lista como WARNING y NO lo toca (revisar a
// mano).
//
// Log persistente: escribe cada proyecto tocado, el cambio aplicado y el ORIGEN
// de la fecha a  $HOME/backups/backfill-pipeline-<ts>.log  (override con la env
// BACKFILL_LOG_DIR). Suple la falta de auditoría del auto-avance para esta
// operación puntual. Todo el log va también a stdout.
//
// Uso:
//   docker compose exec server npx tsx prisma/scripts/normalize-pipeline.ts          # dry-run
//   docker compose exec server npx tsx prisma/scripts/normalize-pipeline.ts --apply  # aplica
//
// NOTA (contenedor): corriendo dentro del contenedor el log cae en
// /root/backups (efímero). Para conservarlo en el host, copialo después con:
//   docker compose cp server:/root/backups/backfill-pipeline-<ts>.log ~/backups/
// o pasá BACKFILL_LOG_DIR apuntando a un volumen montado (p. ej. /app/storage).

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { ProjectStatus } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";
import {
  advancePostventaOnUteFinalizado,
  planPostventaAdvance,
  type StageForAdvance,
} from "../../src/services/ute-sync.service.js";

const APPLY = process.argv.includes("--apply");

// ── Log a archivo + stdout ───────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const logDir = process.env.BACKFILL_LOG_DIR || join(homedir(), "backups");
const logPath = join(logDir, `backfill-pipeline-${ts}.log`);
mkdirSync(logDir, { recursive: true });

function log(line = "") {
  console.log(line);
  appendFileSync(logPath, line + "\n");
}

// Origen de la fecha de cierre, para dejar trazabilidad en el log.
function fechaOrigen(
  ute: { finalizedAt: Date | null },
  stages: StageForAdvance[],
): string {
  if (ute.finalizedAt) return "finalizedAt";
  const hab = stages.find((s) => s.name === "HABILITACION_UTE");
  if (hab?.actualEndDate) return "HABILITACION_UTE.actualEndDate";
  const ops = stages.find((s) => s.name === "OPERACIONES");
  if (ops?.actualEndDate) return "OPERACIONES.actualEndDate";
  return "(ninguna)";
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

type UteRow = { id: string; currentStage: string; finalizedAt: Date | null; updatedAt: Date };

// Trámite "representativo" del proyecto: el finalizado más reciente.
function pickFinalizedUte(utes: UteRow[]): UteRow | null {
  const finalizados = utes.filter((u) => u.currentStage === "FINALIZADO" || u.finalizedAt !== null);
  if (finalizados.length === 0) return null;
  return [...finalizados].sort((a, b) => {
    const fa = a.finalizedAt?.getTime() ?? 0;
    const fb = b.finalizedAt?.getTime() ?? 0;
    if (fb !== fa) return fb - fa;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];
}

async function main() {
  log("═".repeat(78));
  log(`Backfill pipeline POSTVENTA — ${ts}`);
  log(`Modo: ${APPLY ? "APPLY (escribe)" : "DRY-RUN (no escribe)"}`);
  log(`Log: ${logPath}`);
  log("═".repeat(78));

  const candidates = await prisma.project.findMany({
    where: {
      deletedAt: null,
      status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED] },
    },
    select: {
      id: true,
      clientName: true,
      status: true,
      actualEndDate: true,
      uteProcesses: {
        where: { deletedAt: null },
        select: { id: true, currentStage: true, finalizedAt: true, updatedAt: true },
      },
      stages: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          actualStartDate: true,
          actualEndDate: true,
        },
      },
    },
  });

  type Affected = {
    id: string;
    clientName: string;
    status: ProjectStatus;
    ute: UteRow;
    completedAt: Date;
    origen: string;
  };
  type Warning = { clientName: string; id: string; reason: string };

  const toAdvance: Affected[] = [];
  const warnings: Warning[] = [];
  let yaOk = 0;

  for (const p of candidates) {
    const ute = pickFinalizedUte(p.uteProcesses);
    if (!ute) continue; // trámite no finalizado → no afectado

    const stages = p.stages as StageForAdvance[];
    const plan = planPostventaAdvance(ute, stages);

    if (plan.action === "advance") {
      toAdvance.push({
        id: p.id,
        clientName: p.clientName,
        status: p.status,
        ute,
        completedAt: plan.completedAt,
        origen: fechaOrigen(ute, stages),
      });
    } else if (plan.reason === "postventa-ya-completada") {
      yaOk++; // idempotencia: ya estaba bien
    } else if (plan.reason === "habilitacion-no-completada" || plan.reason === "sin-fecha" || plan.reason === "sin-etapa-postventa") {
      warnings.push({ clientName: p.clientName, id: p.id, reason: plan.reason });
    }
  }

  log("");
  log(`Afectados a avanzar: ${toAdvance.length}`);
  log("-".repeat(78));
  for (const a of toAdvance) {
    log(`• ${a.clientName}  (${a.id})`);
    log(`    proyecto:  ${a.status} → COMPLETED`);
    log(`    POSTVENTA: PENDING → COMPLETED`);
    log(`    fecha cierre: ${fmtDate(a.completedAt)}  (origen: ${a.origen})`);
  }

  if (warnings.length > 0) {
    log("");
    log(`⚠️  WARNINGS — finalizados pero NO avanzables (revisar a mano, NO se tocan): ${warnings.length}`);
    for (const w of warnings) {
      log(`    - ${w.clientName} (${w.id}): ${w.reason}`);
    }
  }

  log("");
  log("── Resumen ──");
  log(`A avanzar:            ${toAdvance.length}`);
  log(`Ya OK (idempotente):  ${yaOk}`);
  log(`Warnings (a mano):    ${warnings.length}`);

  if (!APPLY) {
    log("");
    log("(DRY-RUN: no se escribió nada. Para aplicar: agregar --apply.)");
    return;
  }

  log("");
  log("Aplicando…");
  let aplicados = 0;
  for (const a of toAdvance) {
    // Reusa la lógica real del auto-avance (re-lee stages y cierra el proyecto).
    const fullUte = await prisma.uteProcess.findUnique({ where: { id: a.ute.id } });
    if (!fullUte) {
      log(`    ! ${a.clientName}: UteProcess ${a.ute.id} no encontrado al aplicar — skip`);
      continue;
    }
    await advancePostventaOnUteFinalizado(fullUte);

    // Releer para confirmar el estado final y dejarlo en el log.
    const after = await prisma.project.findUnique({
      where: { id: a.id },
      select: {
        status: true,
        actualEndDate: true,
        stages: { where: { deletedAt: null, name: "POSTVENTA" }, select: { status: true } },
      },
    });
    const pv = after?.stages[0]?.status ?? "?";
    log(
      `    ✓ ${a.clientName}: proyecto=${after?.status} actualEndDate=${fmtDate(after?.actualEndDate ?? null)} POSTVENTA=${pv} (fecha ${a.origen})`,
    );
    aplicados++;
  }

  log("");
  log(`✅ APPLY: ${aplicados} proyecto(s) avanzado(s) a POSTVENTA/COMPLETED.`);
}

main()
  .catch((e) => {
    log(`Error: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
