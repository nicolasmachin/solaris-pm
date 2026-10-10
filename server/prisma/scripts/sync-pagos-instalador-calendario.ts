// Ata los pagos a instaladores al calendario, para lo que ya existe.
//
//   docker compose exec server npx tsx prisma/scripts/sync-pagos-instalador-calendario.ts --dry-run
//   docker compose exec server npx tsx prisma/scripts/sync-pagos-instalador-calendario.ts --desde 2026-08-20
//
// --desde AAAA-MM-DD: solo CREA pagos nuevos para obras que arrancan desde esa
// fecha. Las anteriores al módulo de pagos (20-ago-2026) se pagaron por fuera y
// crearles el pago las mostraría como deuda que no existe. Quitar y reasignar
// se hace igual en todas.
//
// Por qué (10-oct-2026): el pago al instalador se creaba al ganar la venta, para
// todas las obras y sin instalador. Quedaban "sin asignar" las de equipo propio
// (que no se pagan aparte) y faltaban las de tercerizados vendidas antes de que
// existiera el módulo (ej. Antonella Brondo, agendada con Fernando y sin pago).
// Desde ahora lo maneja el calendario (`syncInstallerPaymentForProject`).
//
// Hace dos cosas:
//   1. Vincula cada equipo TERCERIZADO sin "quién cobra" con el instalador
//      tercerizado cuyo nombre empieza igual ("Fernando" → "Fernando Leal"). Si
//      no hay uno solo que coincida, no lo toca y lo avisa: se elige en Admin →
//      Equipos.
//   2. Corre la sincronización en cada proyecto con agenda o con pago.
//      Lo que ya tiene entregas no se toca nunca.
//
// Es idempotente: correrlo dos veces no cambia nada la segunda.

import { PrismaClient } from "@prisma/client";

import { syncInstallerPaymentForProject } from "../../src/services/installer-payment/installer-payment.service.js";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");
const iDesde = process.argv.indexOf("--desde");
const DESDE = iDesde >= 0 ? new Date(`${process.argv[iDesde + 1]}T00:00:00Z`) : null;
if (DESDE && Number.isNaN(DESDE.getTime())) throw new Error("--desde tiene que ser AAAA-MM-DD");

async function main() {
  console.log(DRY ? "── DRY RUN: no se escribe nada ──\n" : "");

  // Quién figura como autor de lo que cree el script: el admin más antiguo.
  const admin = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No hay un usuario ADMIN para firmar los cambios");

  // 1) Equipos tercerizados → quién cobra.
  const instaladores = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: "INSTALADOR_TERCERIZADO" } },
    select: { id: true, name: true },
  });
  const equipos = await prisma.team.findMany({ where: { deletedAt: null, type: "TERCERIZADO" } });
  console.log("Equipos tercerizados:");
  for (const t of equipos) {
    if (t.installerUserId) {
      const u = instaladores.find((i) => i.id === t.installerUserId);
      console.log(`  ${t.name}: ya cobra ${u?.name ?? t.installerUserId}`);
      continue;
    }
    const nombre = t.name.trim().toLowerCase();
    const matches = instaladores.filter((i) => (i.name ?? "").trim().toLowerCase().split(/\s+/)[0] === nombre);
    if (matches.length !== 1) {
      console.log(`  ⚠ ${t.name}: ${matches.length === 0 ? "ningún instalador coincide" : "más de uno coincide"} — elegir en Admin → Equipos`);
      continue;
    }
    console.log(`  ${t.name} → cobra ${matches[0].name}`);
    if (!DRY) await prisma.team.update({ where: { id: t.id }, data: { installerUserId: matches[0].id } });
  }

  // 2) Sincronizar cada proyecto con agenda o con pago.
  const [conAgenda, conPago] = await Promise.all([
    prisma.installationSchedule.findMany({ where: { deletedAt: null, project: { deletedAt: null } }, select: { projectId: true } }),
    prisma.installerPayment.findMany({ where: { projectId: { not: null } }, select: { projectId: true } }),
  ]);
  const ids = [...new Set([...conAgenda.map((s) => s.projectId), ...conPago.map((p) => p.projectId!)])];
  const proyectos = await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, clientName: true } });

  const porResultado = new Map<string, string[]>();
  for (const p of proyectos) {
    if (DESDE) {
      const [pago, primerTramo] = await Promise.all([
        prisma.installerPayment.findUnique({ where: { projectId: p.id }, select: { id: true } }),
        prisma.installationSegment.findFirst({
          where: { schedule: { projectId: p.id, deletedAt: null } },
          orderBy: { startDate: "asc" },
          select: { startDate: true },
        }),
      ]);
      if (!pago && primerTramo && primerTramo.startDate < DESDE) {
        const arr = porResultado.get("anterior_a_desde_no_se_crea") ?? [];
        arr.push(`${p.code} ${p.clientName} (obra ${primerTramo.startDate.toISOString().slice(0, 10)})`);
        porResultado.set("anterior_a_desde_no_se_crea", arr);
        continue;
      }
    }
    const r = await syncInstallerPaymentForProject({ projectId: p.id, userId: admin.id, dryRun: DRY });
    const arr = porResultado.get(r) ?? [];
    arr.push(`${p.code} ${p.clientName}`);
    porResultado.set(r, arr);
  }
  console.log(`\nProyectos revisados: ${proyectos.length}`);
  for (const [r, lista] of porResultado) {
    console.log(`\n${r}: ${lista.length}`);
    if (r !== "sin_cambios" && r !== "nada") for (const l of lista) console.log(`  - ${l}`);
  }
  console.log(DRY ? "\n(dry run: en la corrida real los equipos vinculados arriba ya asignan a su instalador)" : "\n✓ Listo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
