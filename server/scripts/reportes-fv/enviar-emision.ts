/**
 * Envía por mail el reporte de UN generador y período, desde la consola.
 *
 * Es la misma acción que el botón "Enviar al cliente" de la ficha: usa
 * `enviarEmision`, así que respeta la idempotencia (no se manda dos veces),
 * registra el envío, publica el reporte en el portal del cliente y le suma la
 * copia oculta interna (REPORTES_FV_BCC).
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/enviar-emision.ts \
 *     PRY-2026-007 2026-08 [--dry-run]
 *
 * `--dry-run` NO manda nada: sólo dice a quién le llegaría. Conviene correrlo
 * antes, porque el envío es hacia afuera y no se puede deshacer.
 *
 * Toma la última versión LISTO del período.
 */

import { ReporteFvEmisionEstado } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";
import { enviarEmision } from "../../src/services/reportesFv/envio.service.js";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [codigo, periodo] = args.filter((a) => !a.startsWith("--"));

  if (!codigo || !periodo) {
    console.error("Uso: enviar-emision.ts <CODIGO> <YYYY-MM> [--dry-run]");
    process.exit(1);
  }

  const proyecto = await prisma.project.findFirst({
    where: { code: codigo },
    select: { id: true, clientName: true },
  });
  if (!proyecto) {
    console.error(`No existe ${codigo}`);
    process.exit(1);
  }

  const emision = await prisma.reporteFvEmision.findFirst({
    where: {
      projectId: proyecto.id,
      periodo: new Date(`${periodo}-01T00:00:00.000Z`),
      estado: ReporteFvEmisionEstado.LISTO,
    },
    orderBy: { version: "desc" },
    select: { id: true, version: true, enviadoEn: true },
  });
  if (!emision) {
    console.error(`No hay reporte LISTO de ${periodo} para ${proyecto.clientName}`);
    process.exit(1);
  }

  if (emision.enviadoEn) {
    console.log(
      `Ya se había enviado el ${emision.enviadoEn.toISOString()}. ` +
        "No se reenvía (el guard de idempotencia lo impide).",
    );
    process.exit(0);
  }

  const admin = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" }, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) {
    console.error("No hay usuario ADMIN para registrar el envío.");
    process.exit(1);
  }

  console.log(`${proyecto.clientName} — ${periodo} (v${emision.version})`);
  const r = await enviarEmision(emision.id, { dryRun, userId: admin.id });
  console.log(`  estado: ${r.estado}`);
  console.log(`  destinatarios: ${r.destinatarios.join(", ") || "(ninguno)"}`);
  if (r.motivo) console.log(`  motivo: ${r.motivo}`);
  console.log(`  copia oculta: ${process.env.REPORTES_FV_BCC || "(sin configurar)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
