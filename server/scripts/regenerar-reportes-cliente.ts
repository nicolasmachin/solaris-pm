/**
 * Regenera los reportes de un cliente con su día de corte y los publica: el
 * mismo camino que el panel (ingesta del período, emisión y envío), para uno solo.
 * Si el cliente no tiene mail, el envío deja el reporte publicado en el portal.
 *
 * Toma los períodos que ya tenían emisión y que con el corte nuevo estén cerrados.
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/regenerar-reportes-cliente.ts --codigo=PRY-2026-093 --corte=24            # simula
 *     npx tsx scripts/regenerar-reportes-cliente.ts --codigo=PRY-2026-093 --corte=24 --aplicar --actor=mail@voltia.com.uy
 */

import { AuditAction, AuditEntityType, ReporteFvEmisionEstado, ReporteFvIngestaModo } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";
import { createAuditEntry } from "../src/services/audit.service.js";
import { generarEmision } from "../src/services/reportesFv/emision.service.js";
import { enviarEmision } from "../src/services/reportesFv/envio.service.js";
import { ingerirPeriodoSincrono } from "../src/services/reportesFv/growatt/ingesta.service.js";
import { dateAPeriodo, periodoCerrado } from "../src/services/reportesFv/periodo.js";

const APLICAR = process.argv.includes("--aplicar");
const opcion = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;

async function main() {
  const codigo = opcion("codigo");
  const corte = Number(opcion("corte"));
  if (!codigo || !Number.isInteger(corte) || corte < 1 || corte > 31) {
    throw new Error("Uso: --codigo=PRY-... --corte=1..31 [--aplicar --actor=mail]");
  }
  const actorMail = opcion("actor");
  const actor = actorMail
    ? await prisma.user.findFirst({ where: { email: actorMail, deletedAt: null }, select: { id: true } })
    : null;
  if (APLICAR && !actor) throw new Error("Para aplicar hace falta --actor=<mail de un usuario existente>");

  const project = await prisma.project.findFirst({
    where: { code: codigo, deletedAt: null },
    select: { id: true, clientName: true, reporteFvConfig: { select: { diaCorteMedidor: true } } },
  });
  if (!project?.reporteFvConfig) throw new Error(`${codigo} no existe o no tiene reporte dado de alta`);

  const emitidas = await prisma.reporteFvEmision.findMany({
    where: { projectId: project.id, estado: { not: ReporteFvEmisionEstado.ANULADO } },
    select: { periodo: true },
    distinct: ["periodo"],
    orderBy: { periodo: "asc" },
  });
  const periodos = emitidas.map((e) => dateAPeriodo(e.periodo)).filter((p) => periodoCerrado(p, corte));

  console.log(`${project.clientName}: corte ${project.reporteFvConfig.diaCorteMedidor ?? "mes calendario"} → ${corte}`);
  console.log(`Períodos: ${periodos.join(", ") || "ninguno"}`);
  if (!APLICAR) return console.log("Simulación: no se cambió nada.");

  await prisma.reporteFvConfig.update({
    where: { projectId: project.id },
    data: { diaCorteMedidor: corte, actualizadoPorId: actor!.id },
  });
  await createAuditEntry({
    entityType: AuditEntityType.reporte_fv_config,
    entityId: project.id,
    projectId: project.id,
    userId: actor!.id,
    action: AuditAction.updated,
    description: `Día de corte del medidor fijado en ${corte}`,
  });

  // Primero se traen todos los períodos con el corte nuevo y después se emite:
  // cada emisión recalcula la serie entera.
  for (const periodo of periodos) {
    await ingerirPeriodoSincrono({ periodo, modo: ReporteFvIngestaModo.MANUAL, projectIds: [project.id], force: true, userId: actor!.id });
  }
  for (const periodo of periodos) {
    try {
      const e = await generarEmision(project.id, periodo, actor!.id);
      const envio = await enviarEmision(e.emisionId, { userId: actor!.id });
      console.log(`${periodo}: versión ${e.version} · ${envio.estado}${envio.motivo ? ` (${envio.motivo})` : ""}`);
    } catch (err) {
      console.error(`${periodo}: ERROR ${(err as Error).message}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  // Los servicios que importa dejan temporizadores abiertos: se sale a mano.
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
