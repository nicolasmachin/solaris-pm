/**
 * Sincroniza el catálogo de FusionSolar y sugiere vinculaciones por nombre.
 *
 *   docker compose exec server npx tsx scripts/reportes-fv/sync-huawei.ts
 *   docker compose exec server npx tsx scripts/reportes-fv/sync-huawei.ts --vincular
 *   docker compose exec server npx tsx scripts/reportes-fv/sync-huawei.ts --ingerir 2026-07
 *
 * Sin flags sólo lista y muestra qué haría: la vinculación se confirma a mano
 * porque asociar la planta al proyecto equivocado le manda a un cliente el
 * consumo de otro.
 */

import { PrismaClient } from "@prisma/client";

import { ingerirPeriodoHuawei } from "../../src/services/reportesFv/huawei/ingesta.service.js";
import {
  marcarOrigenHuawei,
  sincronizarPlantasHuawei,
  vincularPlantaHuawei,
} from "../../src/services/reportesFv/huawei/plantas.service.js";

const prisma = new PrismaClient();

/** Normaliza para comparar: sin acentos, sin puntuación, minúsculas. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sa|srl|s\.a\.|s\.r\.l\.)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Puntaje de parecido. Compartir UNA palabra no alcanza: "Jorge Alvarez" daba
 * cuatro candidatos (Rodrigo Alvarez, Jorge Fajardo, Jorge Tello…). El nombre
 * completo igual gana siempre; si no, se exige más de una palabra en común.
 */
function puntaje(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 100;

  const pa = new Set(na.split(" ").filter((w) => w.length >= 4));
  const comunes = nb.split(" ").filter((w) => w.length >= 4 && pa.has(w));
  // Una sola palabra en común sólo vale si es todo lo que tiene el nombre de la
  // planta ("Cidel - Barenof" → "BARENOF SA").
  if (comunes.length === 1 && pa.size <= 2) return 10;
  return comunes.length >= 2 ? 50 : 0;
}

function mejores(nombrePlanta: string, proyectos: { clientName: string }[]) {
  const conPuntaje = proyectos
    .map((pr) => ({ pr, p: puntaje(nombrePlanta, pr.clientName) }))
    .filter((x) => x.p > 0);
  if (!conPuntaje.length) return [];
  const max = Math.max(...conPuntaje.map((x) => x.p));
  return conPuntaje.filter((x) => x.p === max).map((x) => x.pr);
}

async function main() {
  const args = process.argv.slice(2);
  const vincular = args.includes("--vincular");
  const periodoIngesta = args.includes("--ingerir")
    ? args[args.indexOf("--ingerir") + 1]
    : null;

  const sync = await sincronizarPlantasHuawei();
  console.log(
    `Catálogo FusionSolar: ${sync.total} plantas (${sync.nuevas} nuevas, ${sync.actualizadas} ya conocidas)\n`,
  );

  const plantas = await prisma.huaweiPlant.findMany({
    include: { project: { select: { code: true, clientName: true } } },
    orderBy: { name: "asc" },
  });
  const proyectos = await prisma.project.findMany({
    select: { id: true, code: true, clientName: true },
  });

  const admin = await prisma.user.findFirst({ where: { role: { name: "ADMIN" } } });

  for (const p of plantas) {
    if (p.projectId) {
      // Idempotente y barato: asegura el origen también en las ya vinculadas,
      // que es lo que hace falta al correr esto por primera vez en producción.
      await marcarOrigenHuawei(p.projectId);
      console.log(`✅ ${p.name.padEnd(24)} → ${p.project?.clientName} (${p.project?.code})`);
      continue;
    }

    const candidatos = mejores(p.name, proyectos) as typeof proyectos;
    if (candidatos.length === 1 && vincular && admin) {
      await vincularPlantaHuawei(p.plantCode, candidatos[0].id, admin.id);
      console.log(`🔗 ${p.name.padEnd(24)} → ${candidatos[0].clientName} (${candidatos[0].code}) VINCULADA`);
    } else if (candidatos.length === 1) {
      console.log(`•  ${p.name.padEnd(24)} → sugerido: ${candidatos[0].clientName} (${candidatos[0].code})`);
    } else if (candidatos.length > 1) {
      console.log(
        `⚠️  ${p.name.padEnd(24)} → ${candidatos.length} candidatos: ` +
          candidatos.map((c) => `${c.clientName} (${c.code})`).join(" · "),
      );
    } else {
      console.log(`❌ ${p.name.padEnd(24)} → sin proyecto que le corresponda`);
    }
  }

  if (periodoIngesta) {
    console.log(`\nIngiriendo ${periodoIngesta}…`);
    const r = await ingerirPeriodoHuawei(periodoIngesta as `${number}-${number}`);
    console.log(`\n${r.plantas} plantas · ${r.guardadas} guardadas · ${r.omitidas} omitidas\n`);
    for (const i of r.items) {
      const detalle = i.omitido
        ? `OMITIDA — ${i.omitido}`
        : `gen ${i.generacionKwh} · consumo ${i.consumoKwh ?? "—"} · export ${i.exportacionKwh ?? "—"}` +
          ` (${i.diasConDatos}/${i.diasEsperados})${i.motivo ? ` · ${i.motivo}` : ""}`;
      console.log(`  ${i.nombre.padEnd(24)} ${detalle}`);
    }
  }

  if (!vincular && plantas.some((p) => !p.projectId)) {
    console.log("\nPara aplicar las vinculaciones sugeridas: agregá --vincular");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
