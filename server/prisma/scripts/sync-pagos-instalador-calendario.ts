// Ordena los pagos a instaladores que ya existían cuando el pago pasó a
// crearse desde el calendario (10-oct-2026). Se corre UNA vez, al deployar.
//
//   docker compose exec server npx tsx prisma/scripts/sync-pagos-instalador-calendario.ts --desde 2026-10-10 --incluir PRY-2026-047 --dry-run
//   docker compose exec server npx tsx prisma/scripts/sync-pagos-instalador-calendario.ts --desde 2026-10-10 --incluir PRY-2026-047
//
// Por qué: el pago al instalador se creaba al ganar la venta, para todas las
// obras y sin instalador. Quedaban "sin asignar" las de equipo propio (que no
// se pagan aparte) y faltaban las de tercerizados vendidas antes del módulo.
// Desde ahora lo crea el calendario la primera vez que la obra se agenda con un
// equipo tercerizado (`crearPagoAlAgendar`).
//
// Hace tres cosas:
//   1. Vincula cada equipo TERCERIZADO sin "quién cobra" con el instalador
//      tercerizado cuyo nombre empieza igual ("Fernando" → "Fernando Leal"). Si
//      no hay uno solo que coincida, no lo toca y lo avisa (se elige en Admin →
//      Equipos).
//   2. Quita los pagos que sobran: sin instalador, sin nada pagado, y cuya obra
//      no está agendada con un equipo tercerizado (equipo propio o sin agenda).
//   3. Crea el pago de las obras agendadas con tercerizados que no tienen uno,
//      solo si la obra arranca desde --desde. Nicolás decidió "de ahora en
//      adelante": las anteriores se pagaron por fuera, y crearles el pago las
//      mostraría como deuda que no existe. --incluir CÓDIGO[,CÓDIGO] fuerza
//      excepciones puntuales (Antonella Brondo, PRY-2026-047, pedido el 10-oct).
//
// Lo que tiene algo pagado no se toca nunca. Es idempotente.

import { InstallerPaymentStatus, PrismaClient } from "@prisma/client";

import { crearPagoAlAgendar } from "../../src/services/installer-payment/installer-payment.service.js";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");

function arg(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
const desdeTxt = arg("--desde");
const DESDE = desdeTxt ? new Date(`${desdeTxt}T00:00:00Z`) : null;
if (DESDE && Number.isNaN(DESDE.getTime())) throw new Error("--desde tiene que ser AAAA-MM-DD");
const INCLUIR = new Set((arg("--incluir") ?? "").split(",").map((c) => c.trim()).filter(Boolean));

async function main() {
  console.log(DRY ? "── DRY RUN: no se escribe nada ──\n" : "");
  if (!DESDE) console.log("⚠ Sin --desde: se crean pagos para TODAS las obras tercerizadas sin pago.\n");

  // Quién figura como autor de lo que cree el script: el admin más antiguo.
  const admin = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("No hay un usuario ADMIN para firmar los cambios");

  // 1) Equipos tercerizados → quién cobra.
  const instaladores = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: "INSTALADOR_TERCERIZADO" } },
    select: { id: true, name: true },
  });
  const equipos = await prisma.team.findMany({ where: { deletedAt: null, type: "TERCERIZADO" } });
  const cobraPorEquipo = new Map<string, string | null>();
  console.log("1) Equipos tercerizados:");
  for (const t of equipos) {
    if (t.installerUserId) {
      cobraPorEquipo.set(t.id, t.installerUserId);
      const u = instaladores.find((i) => i.id === t.installerUserId);
      console.log(`   ${t.name}: ya cobra ${u?.name ?? t.installerUserId}`);
      continue;
    }
    const nombre = t.name.trim().toLowerCase();
    const matches = instaladores.filter((i) => (i.name ?? "").trim().toLowerCase().split(/\s+/)[0] === nombre);
    if (matches.length !== 1) {
      cobraPorEquipo.set(t.id, null);
      console.log(`   ⚠ ${t.name}: ${matches.length === 0 ? "ningún instalador coincide" : "más de uno coincide"} — elegir en Admin → Equipos`);
      continue;
    }
    cobraPorEquipo.set(t.id, matches[0].id);
    console.log(`   ${t.name} → cobra ${matches[0].name}`);
    if (!DRY) await prisma.team.update({ where: { id: t.id }, data: { installerUserId: matches[0].id } });
  }

  // 2) Quitar los sobrantes.
  const sinAsignar = await prisma.installerPayment.findMany({
    where: { deletedAt: null, installerId: null, projectId: { not: null }, status: InstallerPaymentStatus.PENDIENTE },
    include: {
      project: {
        select: {
          code: true,
          clientName: true,
          installationSchedule: { select: { deletedAt: true, teamType: true, team: { select: { type: true } } } },
        },
      },
      movimientos: { where: { deletedAt: null }, select: { id: true } },
    },
  });
  console.log("\n2) Pagos sin asignar que sobran (equipo propio o sin agenda):");
  let quitados = 0;
  for (const p of sinAsignar) {
    if (p.movimientos.length > 0) continue;
    const s = p.project?.installationSchedule;
    const tercerizado = s && !s.deletedAt && (s.team?.type ?? s.teamType) === "TERCERIZADO";
    if (tercerizado) continue;
    quitados++;
    console.log(`   - ${p.project?.code} ${p.project?.clientName}`);
    if (!DRY) await prisma.installerPayment.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
  }
  console.log(`   Total: ${quitados}`);

  // 3) Crear los que faltan en obras tercerizadas.
  const agendas = await prisma.installationSchedule.findMany({
    where: { deletedAt: null, project: { deletedAt: null, installerPayment: null } },
    include: {
      team: { select: { type: true, name: true } },
      project: { select: { id: true, code: true, clientName: true } },
      segments: { orderBy: { startDate: "asc" }, take: 1, select: { startDate: true } },
    },
  });
  console.log("\n3) Obras tercerizadas sin pago:");
  for (const a of agendas) {
    if ((a.team?.type ?? a.teamType) !== "TERCERIZADO") continue;
    const inicio = a.segments[0]?.startDate ?? null;
    const fecha = inicio ? inicio.toISOString().slice(0, 10) : "sin fecha";
    const excepcion = INCLUIR.has(a.project.code);
    if (DESDE && inicio && inicio < DESDE && !excepcion) {
      console.log(`   · ${a.project.code} ${a.project.clientName} (obra ${fecha}): anterior al corte, no se crea`);
      continue;
    }
    const cobra = a.teamId ? cobraPorEquipo.get(a.teamId) : null;
    const quien = instaladores.find((i) => i.id === cobra)?.name ?? "sin asignar";
    console.log(`   + ${a.project.code} ${a.project.clientName} (obra ${fecha}, ${a.teamName} → ${quien})${excepcion ? "  [excepción]" : ""}`);
    if (!DRY) await crearPagoAlAgendar({ projectId: a.project.id, userId: admin.id });
  }

  console.log(DRY ? "\n(dry run)" : "\n✓ Listo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
