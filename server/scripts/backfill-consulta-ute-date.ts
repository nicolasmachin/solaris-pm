// Backfill: completa UteProcess.consultaSentAt (fecha de la consulta a UTE) para
// proyectos donde la consulta ya se hizo pero la fecha nunca se cargó a mano en
// el módulo de Trámites UTE.
//
// Dos fuentes de fecha, en orden de preferencia (por proyecto):
//   1. EmailLog del mail "Consulta UTE" (templateKey `consulta_ute`, status SENT):
//      el envío exitoso más antiguo. Es la fecha real en que se envió la consulta.
//   2. Fallback: la subetapa de Onboarding "Consulta inicial UTE" COMPLETED con
//      su `actualEndDate` (para consultas hechas fuera del sistema o antes de la
//      función de mail, que igual quedaron marcadas como completadas).
// Se guarda solo la parte de fecha (la columna es @db.Date).
//
// Idempotente y no destructivo: SOLO toca procesos UTE con consultaSentAt null.
// Nunca pisa una fecha existente (respeta las cargadas/editadas a mano).
//
// Correr con:
//   docker compose exec server node --import tsx scripts/backfill-consulta-ute-date.ts            → DRY-RUN
//   docker compose exec server node --import tsx scripts/backfill-consulta-ute-date.ts --execute  → aplica

import { EmailStatus, PrismaClient, SubstageStatus } from "@prisma/client";

import { CONSULTA_UTE_KEY } from "../src/services/email/seed-templates.js";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");
const SUBETAPA_CONSULTA = "Consulta inicial UTE";

// Timestamptz → Date a medianoche UTC (solo la parte de fecha).
function toDateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main() {
  console.log(`=== Backfill consultaSentAt (${EXECUTE ? "EXECUTE" : "DRY-RUN"}) ===\n`);

  // Todos los procesos UTE vivos con la fecha de consulta vacía.
  const procesos = await prisma.uteProcess.findMany({
    where: { deletedAt: null, consultaSentAt: null, project: { deletedAt: null } },
    select: { id: true, projectId: true, project: { select: { code: true, clientName: true } } },
  });
  const projectIds = procesos.map((p) => p.projectId);
  console.log(`Procesos UTE con consultaSentAt null: ${procesos.length}`);

  // Fuente 1 — EmailLog: envío exitoso más antiguo por proyecto (first-wins).
  const logs = await prisma.emailLog.findMany({
    where: {
      templateKey: CONSULTA_UTE_KEY,
      status: EmailStatus.SENT,
      projectId: { in: projectIds },
    },
    select: { projectId: true, sentAt: true },
    orderBy: { sentAt: "asc" },
  });
  const mailByProject = new Map<string, Date>();
  for (const l of logs) {
    if (l.projectId && !mailByProject.has(l.projectId)) mailByProject.set(l.projectId, l.sentAt);
  }

  // Fuente 2 — subetapa "Consulta inicial UTE" COMPLETED con actualEndDate.
  const subs = await prisma.substage.findMany({
    where: {
      projectId: { in: projectIds },
      name: SUBETAPA_CONSULTA,
      status: SubstageStatus.COMPLETED,
      actualEndDate: { not: null },
    },
    select: { projectId: true, actualEndDate: true },
    orderBy: { actualEndDate: "asc" },
  });
  const subByProject = new Map<string, Date>();
  for (const s of subs) {
    if (s.actualEndDate && !subByProject.has(s.projectId)) subByProject.set(s.projectId, s.actualEndDate);
  }

  console.log(`  · con fecha por mail (EmailLog): ${mailByProject.size}`);
  console.log(`  · con fecha por subetapa completada: ${subByProject.size}\n`);

  let updated = 0;
  let sinFuente = 0;
  for (const p of procesos) {
    const mail = mailByProject.get(p.projectId);
    const sub = subByProject.get(p.projectId);
    const origen = mail ? "mail" : sub ? "subetapa" : null;
    const fuente = mail ?? sub;
    if (!fuente || !origen) {
      sinFuente++;
      continue;
    }
    const fecha = toDateOnlyUtc(fuente);
    console.log(`  ${p.project.code} · ${p.project.clientName} → ${fecha.toISOString().slice(0, 10)} (${origen})`);
    if (EXECUTE) {
      const res = await prisma.uteProcess.updateMany({
        where: { id: p.id, consultaSentAt: null },
        data: { consultaSentAt: fecha },
      });
      updated += res.count;
    }
  }

  const conFuente = procesos.length - sinFuente;
  console.log(
    `\n${EXECUTE ? `Actualizados: ${updated}` : `Se actualizarían: ${conFuente}`}` +
      ` · sin fuente de fecha (se dejan null): ${sinFuente}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
