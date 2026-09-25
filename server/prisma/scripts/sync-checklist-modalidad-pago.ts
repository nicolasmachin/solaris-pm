/**
 * Agrega a los proyectos que ya existen los ítems nuevos de la subetapa
 * "Modalidad de pago definida".
 *
 * El checklist de un proyecto se copia del catálogo **cuando el proyecto se
 * crea**: agregar un ítem al catálogo no lo hace aparecer en los proyectos en
 * curso. Sin este script la feature valdría solo para los proyectos nuevos, y los
 * que están andando —que son los que hoy no tienen plan de pagos— seguirían igual.
 *
 * Qué hace, por cada proyecto vivo con esa subetapa sin completar:
 *   1. Le suma los ítems que le falten ("Proforma generada", "Plan de pagos
 *      creado", "Qué se acordó, explicado"), cada uno con su `evidenceKind` y su
 *      `appliesWhenModalidadPago`.
 *   2. Marca de una los que ya tengan su evidencia: si el proyecto ya tiene la
 *      proforma o el plan hechos, el ítem nace tildado en vez de aparecer como
 *      trabajo pendiente que ya está hecho.
 *
 * **No toca las subetapas ya completadas**: agregarles un ítem sin completar las
 * dejaría inconsistentes (completas con pendientes adentro) y nadie va a volver
 * sobre un onboarding cerrado. Esos proyectos quedan como están, que es la
 * decisión que se tomó para los que ya no tienen plan de pagos.
 *
 *   # ver qué haría, sin tocar nada:
 *   docker compose exec server npx tsx prisma/scripts/sync-checklist-modalidad-pago.ts
 *   # aplicar:
 *   docker compose exec server npx tsx prisma/scripts/sync-checklist-modalidad-pago.ts --apply
 */

import { ModalidadPago, PrismaClient, SubstageStatus } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const SUBETAPA = "Modalidad de pago definida";

const NUEVOS = [
  {
    label: "Proforma generada",
    evidenceKind: "proforma",
    appliesWhenModalidadPago: ModalidadPago.FINANCIACION_BANCARIA,
    orderAfter: "Modalidad de pago definida",
  },
  {
    label: "Plan de pagos creado",
    evidenceKind: "plan-pagos",
    appliesWhenModalidadPago: ModalidadPago.DIRECTO_50_50,
    orderAfter: null,
  },
  {
    label: "Qué se acordó, explicado",
    evidenceKind: "modalidad-otro",
    appliesWhenModalidadPago: ModalidadPago.OTRO,
    orderAfter: null,
  },
];

async function main(): Promise<void> {
  const substages = await prisma.substage.findMany({
    where: {
      name: SUBETAPA,
      deletedAt: null,
      status: { not: SubstageStatus.COMPLETED },
      stage: { project: { deletedAt: null } },
    },
    select: {
      id: true,
      projectId: true,
      stage: { select: { project: { select: { clientName: true, modalidadPago: true } } } },
      checklistItems: {
        where: { deletedAt: null },
        select: { label: true, order: true },
      },
    },
  });

  console.log(`Subetapas "${SUBETAPA}" sin completar: ${substages.length}`);

  let aCrear = 0;
  const porProyecto: string[] = [];

  for (const sub of substages) {
    const existentes = new Set(sub.checklistItems.map((i) => i.label));
    const faltan = NUEVOS.filter((n) => !existentes.has(n.label));
    if (faltan.length === 0) continue;

    aCrear += faltan.length;
    const modalidad = sub.stage.project.modalidadPago;
    porProyecto.push(
      `  ${sub.stage.project.clientName} (modalidad: ${modalidad ?? "sin elegir"}) → ` +
        faltan.map((f) => f.label).join(", "),
    );

    if (!APPLY) continue;

    const maxOrder = Math.max(0, ...sub.checklistItems.map((i) => i.order ?? 0));
    await prisma.checklistItem.createMany({
      data: faltan.map((n, i) => ({
        projectId: sub.projectId,
        substageId: sub.id,
        label: n.label,
        isRequired: true,
        evidenceKind: n.evidenceKind,
        appliesWhenModalidadPago: n.appliesWhenModalidadPago,
        order: maxOrder + i + 1,
        completed: false,
      })),
    });
  }

  console.log(`Ítems a crear: ${aCrear}`);
  for (const linea of porProyecto.slice(0, 20)) console.log(linea);
  if (porProyecto.length > 20) console.log(`  …y ${porProyecto.length - 20} proyectos más`);

  if (!APPLY) {
    console.log("\n(simulación — nada se tocó; agregá --apply para aplicarlo)");
    return;
  }

  // Los que ya tienen la evidencia nacen tildados: el trabajo está hecho.
  const { completarPorEvidencia } = await import("../../src/services/checklist-evidencias.js");
  const admin = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" }, deletedAt: null },
    select: { id: true },
  });
  if (admin) {
    const proyectos = [...new Set(substages.map((s) => s.projectId))];
    let marcados = 0;
    for (const projectId of proyectos) {
      for (const kind of ["proforma", "plan-pagos", "modalidad-otro"]) {
        const r = await completarPorEvidencia(projectId, kind, admin.id);
        marcados += r.substageIds.length;
      }
    }
    console.log(`Ítems marcados por evidencia ya existente: ${marcados}`);
  }

  console.log("\nListo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
