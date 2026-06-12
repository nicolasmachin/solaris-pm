/**
 * One-shot: siembra la plantilla de sistema "Consulta UTE" si aún no existe.
 *
 * Idempotente (create-if-absent por `key`): re-correrlo NO pisa ediciones de
 * ADMIN. Independiente del seed general (prisma/seed.ts), que hoy arrastra
 * deriva preexistente y puede no completar.
 *
 * Uso en local:
 *   docker compose exec server npx tsx scripts/seed-email-templates.ts
 *
 * Uso en producción (tras migrate deploy):
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/seed-email-templates.ts
 */

import { prisma } from "../src/lib/prisma.js";
import { seedConsultaUteTemplate } from "../src/services/email/seed-templates.js";

async function main() {
  await seedConsultaUteTemplate(prisma);
}

main()
  .catch((error) => {
    console.error("Error sembrando plantillas de email:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
