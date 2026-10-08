/**
 * Rellena la serie diaria (generación + exportación) de las plantas Huawei.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/backfill-huawei-diaria.ts \
 *     --desde 2026-04 [--hasta 2026-10]
 *
 * El monitoreo diario sólo trae el mes en curso, y hasta oct-2026 guardaba la
 * generación pero no la exportación. Esto pide mes por mes la serie de toda la
 * flota Huawei vinculada (una llamada por mes, `getKpiStationDay`) y guarda los
 * dos datos con la misma lógica que el monitoreo. Idempotente: se puede correr
 * dos veces. No pisa días cargados a mano.
 */

import { ReporteFvFuente } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";
import { serieDiariaDelMes } from "../../src/services/reportesFv/huawei/client.js";
import type { Dia } from "../../src/services/reportesFv/monitor/dias.js";
import {
  guardarExportacionHuawei,
  guardarGeneracionDiaria,
} from "../../src/services/reportesFv/monitor/generacion-diaria.service.js";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function meses(desde: string, hasta: string): { anio: number; mes: number }[] {
  const salida: { anio: number; mes: number }[] = [];
  let [anio, mes] = desde.split("-").map(Number);
  const [anioFin, mesFin] = hasta.split("-").map(Number);
  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    salida.push({ anio, mes });
    mes++;
    if (mes > 12) {
      mes = 1;
      anio++;
    }
  }
  return salida;
}

async function main() {
  const desde = arg("desde");
  const hasta = arg("hasta") ?? new Date().toISOString().slice(0, 7);
  if (!desde || !MES.test(desde) || !MES.test(hasta)) {
    console.error("Uso: --desde YYYY-MM [--hasta YYYY-MM]");
    process.exit(1);
  }

  const plantas = await prisma.huaweiPlant.findMany({
    where: { ignorada: false, projectId: { not: null } },
    select: { plantCode: true, name: true, projectId: true },
    orderBy: { name: "asc" },
  });
  const codigos = plantas.map((p) => p.plantCode);
  console.log(`Backfill Huawei ${desde} → ${hasta} · ${plantas.length} plantas\n`);

  let filasGen = 0;
  let filasExp = 0;
  for (const { anio, mes } of meses(desde, hasta)) {
    const etiqueta = `${anio}-${String(mes).padStart(2, "0")}`;
    try {
      const { series } = await serieDiariaDelMes(codigos, anio, mes);
      for (const p of plantas) {
        const dias = series.get(p.plantCode) ?? [];
        if (!dias.length) continue;
        const serie = new Map<Dia, number>(dias.map((d) => [d.fecha as Dia, d.generacionKwh]));
        const gen = await guardarGeneracionDiaria(p.projectId!, null, serie, ReporteFvFuente.HUAWEI);
        const exp = await guardarExportacionHuawei(p.projectId!, dias);
        filasGen += gen;
        filasExp += exp;
        console.log(`${etiqueta} · ${p.name}: ${gen} días de generación, ${exp} de exportación`);
      }
    } catch (err) {
      console.error(`${etiqueta}: ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nListo: ${filasGen} días de generación · ${filasExp} días de exportación`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
