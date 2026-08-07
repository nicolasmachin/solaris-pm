/**
 * Corrida manual del monitoreo diario.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/correr-monitor.ts \
 *     [--fecha 2026-08-06] [--sin-email] [--plant 1419543] [--plant 2789667]
 *
 * Sin --fecha evalúa el día anterior, igual que el cron.
 */

import { FvMonitorCorridaModo } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";
import { esDiaValido } from "../../src/services/reportesFv/monitor/dias.js";
import { DIAGNOSTICO_LABEL } from "../../src/services/reportesFv/monitor/diagnostico.js";
import {
  asuntoDigest,
  enviarDigest,
  renderDigestTexto,
} from "../../src/services/reportesFv/monitor/digest.email.js";
import { ejecutarMonitorDiario } from "../../src/services/reportesFv/monitor/monitor.service.js";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function args(nombre: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${nombre}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

async function main() {
  const fecha = arg("fecha");
  if (fecha && !esDiaValido(fecha)) {
    console.error(`Fecha inválida: "${fecha}" (se espera YYYY-MM-DD)`);
    process.exit(1);
  }
  const plantas = args("plant").map((p) => BigInt(p));
  const sinEmail = process.argv.includes("--sin-email");

  const t0 = Date.now();
  const resumen = await ejecutarMonitorDiario(new Date(), {
    modo: FvMonitorCorridaModo.MANUAL,
    fecha,
    plantIds: plantas.length > 0 ? plantas : undefined,
  });

  console.log("\n" + "═".repeat(70));
  console.log(`Corrida ${resumen.corridaId} — día evaluado ${resumen.fecha}`);
  console.log("═".repeat(70));
  console.log(
    `Plantas: ${resumen.plantasTotal} · ok ${resumen.plantasOk} · error ${resumen.plantasError} · ` +
      `${resumen.requests} requests · ${Math.round((Date.now() - t0) / 1000)} s`,
  );
  console.log("\nPor diagnóstico:");
  for (const [k, v] of Object.entries(resumen.porDiagnostico).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${DIAGNOSTICO_LABEL[k as keyof typeof DIAGNOSTICO_LABEL] ?? k}`);
  }
  if (resumen.fallaMasiva) console.log("\n⚠ Falla masiva: no se abrieron incidencias.");
  if (resumen.corridaRota) console.log("\n⚠ Corrida rota: Growatt no respondió para buena parte de la flota.");

  console.log(
    `\nIncidencias: ${resumen.incidenciasNuevas.length} nuevas · ` +
      `${resumen.incidenciasAbiertas.length} abiertas · ${resumen.incidenciasResueltas.length} resueltas`,
  );
  for (const f of resumen.incidenciasNuevas) {
    console.log(`  NUEVA  ${f.clientName ?? f.plantName} — ${DIAGNOSTICO_LABEL[f.diagnostico]}: ${f.detalle}`);
  }
  if (resumen.erroresConsulta.length > 0) {
    console.log("\nErrores de consulta (primeros 5):");
    for (const e of resumen.erroresConsulta.slice(0, 5)) {
      console.log(`  ${e.clientName ?? e.plantName}: ${e.error}`);
    }
  }

  if (sinEmail) {
    console.log(`\n── Digest que se habría mandado ──\nAsunto: ${asuntoDigest(resumen)}\n`);
    console.log(renderDigestTexto(resumen));
  } else {
    const enviado = await enviarDigest(resumen);
    console.log(`\nDigest: ${enviado ? "enviado" : "no se mandó (sin novedades o deshabilitado)"}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
