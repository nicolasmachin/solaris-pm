/**
 * One-shot: actualiza el CUERPO de la plantilla de sistema "Consulta UTE" para
 * llevar la firma dinámica del remitente (namespace `firma`).
 *
 * Necesario porque el seed es create-if-absent: NO pisa la fila ya sembrada, así
 * que en entornos que ya tienen la plantilla (local y PROD) hay que correr esto.
 *
 * Idempotente: crea la fila si falta y actualiza el cuerpo si existe. Solo toca
 * `bodyTemplate` (preserva to/cc/bcc/subject editados por ADMIN).
 *
 * Uso en local:
 *   docker compose exec server npx tsx scripts/update-consulta-ute-template.ts
 *
 * Uso en producción (tras migrate deploy):
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/update-consulta-ute-template.ts
 */

import { prisma } from "../src/lib/prisma.js";
import { seedConsultaUteTemplate, updateConsultaUteBody } from "../src/services/email/seed-templates.js";

async function main() {
  await seedConsultaUteTemplate(prisma); // crea si falta (fresh install)
  await updateConsultaUteBody(prisma); // actualiza el cuerpo con la firma dinámica
}

main()
  .catch((error) => {
    console.error("Error actualizando la plantilla 'consulta_ute':", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
