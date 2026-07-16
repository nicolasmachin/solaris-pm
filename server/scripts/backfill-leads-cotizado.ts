// Backfill: todos los leads de ventas que ya tienen una propuesta comercial
// generada (nueva ProposalV2Version o vieja ProposalGeneration) pasan a etapa
// COTIZADO, con proposalSentAt = fecha de la PRIMERA propuesta.
//
// Reutiliza autoPromoteLeadToCotizado (forward-only: no toca leads ya en etapas
// posteriores/cerradas; solo les setea la fecha si estaba vacía). Idempotente.
//
// Correr con: docker compose exec server node --import tsx scripts/backfill-leads-cotizado.ts

import { PrismaClient } from "@prisma/client";

import { autoPromoteLeadToCotizado } from "../src/services/proposal/promote-lead.service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Backfill: leads con propuesta → COTIZADO ===\n");

  // SalesActivity.userId / AuditLog.userId son NOT NULL: usamos un ADMIN.
  const admin = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No se encontró un usuario ADMIN para registrar la actividad/auditoría");

  const [v2, gen] = await Promise.all([
    prisma.proposalV2Version.findMany({ distinct: ["leadId"], select: { leadId: true } }),
    prisma.proposalGeneration.findMany({
      where: { leadId: { not: null } },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
  ]);
  const leadIds = [
    ...new Set([...v2.map((x) => x.leadId), ...gen.map((x) => x.leadId)].filter((id): id is string => !!id)),
  ];
  console.log(`Leads con al menos una propuesta: ${leadIds.length}\n`);

  let promovidos = 0;
  let soloFecha = 0;
  let sinCambio = 0;

  for (const leadId of leadIds) {
    const before = await prisma.salesLead.findUnique({
      where: { id: leadId },
      select: { stage: true, proposalSentAt: true, clientName: true, deletedAt: true },
    });
    if (!before || before.deletedAt) continue;

    const promoted = await autoPromoteLeadToCotizado({
      leadId,
      userId: admin.id,
      motivo: "Backfill: lead con propuesta generada → COTIZADO",
    });

    if (promoted) {
      promovidos++;
      console.log(`  ✓ ${before.clientName}: ${before.stage} → COTIZADO`);
    } else {
      const after = await prisma.salesLead.findUnique({
        where: { id: leadId },
        select: { proposalSentAt: true },
      });
      if (!before.proposalSentAt && after?.proposalSentAt) soloFecha++;
      else sinCambio++;
    }
  }

  console.log("\n=== Completado ===");
  console.log(`  Promovidos a COTIZADO:                 ${promovidos}`);
  console.log(`  Solo fecha seteada (ya avanzados):     ${soloFecha}`);
  console.log(`  Sin cambios (ya tenían todo):          ${sinCambio}`);
}

main()
  .catch((err) => {
    console.error("\n✗ Error en el backfill:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
