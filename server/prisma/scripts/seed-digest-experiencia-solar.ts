/**
 * Habilita el resumen diario por correo para los roles que acompañan al cliente.
 *
 * Problema que resuelve: `digest_preferences` es opt-in por rol y **sin filas un
 * rol no recibe nada**. En producción solo estaba cargado ADMIN, así que la
 * responsable de Experiencia Solar no recibía ni un solo correo de alerta: ni
 * avisos de habilitación pendientes, ni traspasos, ni tickets, ni encuestas.
 * Todo dependía de que abriera la app y mirara la campana.
 *
 * Idempotente: createMany + skipDuplicates. Se puede correr varias veces.
 *
 *   docker compose exec server npx tsx prisma/scripts/seed-digest-experiencia-solar.ts
 *   (prod: docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/seed-digest-experiencia-solar.ts)
 *
 * No hace falta reiniciar el server: el job del digest lee la tabla en cada corrida.
 */

import { NotificationType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Qué tipo de aviso recibe por correo cada rol. Solo los que le exigen una acción
// o que necesita saber para acompañar al cliente; se dejan afuera los de pipeline
// interno (deadline_warning, prev_substage_completed, engineering_completed), que
// son ruido para estos roles.
const PREFERENCIAS: Record<string, NotificationType[]> = {
  EXPERIENCIA_SOLAR: [
    NotificationType.aviso_habilitacion_pendiente,
    NotificationType.traspaso_asignado,
    NotificationType.traspaso_por_confirmar,
    NotificationType.traspaso_escalado,
    NotificationType.ticket_actualizado,
    NotificationType.encuesta_disponible,
  ],
  POSTVENTA: [
    NotificationType.aviso_habilitacion_pendiente,
    NotificationType.traspaso_asignado,
    NotificationType.traspaso_por_confirmar,
    NotificationType.ticket_actualizado,
    NotificationType.encuesta_disponible,
  ],
};

async function main(): Promise<void> {
  const roles = await prisma.role.findMany({ select: { name: true } });
  const existentes = new Set(roles.map((r) => r.name));

  const filas: Array<{ roleName: string; notificationType: NotificationType }> = [];
  for (const [roleName, tipos] of Object.entries(PREFERENCIAS)) {
    if (!existentes.has(roleName)) {
      console.warn(`[digest-cx] el rol ${roleName} no existe, se saltea`);
      continue;
    }
    for (const notificationType of tipos) filas.push({ roleName, notificationType });
  }

  const creadas = await prisma.digestPreference.createMany({ data: filas, skipDuplicates: true });
  console.log(`[digest-cx] filas creadas: ${creadas.count} (de ${filas.length} intentadas)`);

  for (const roleName of Object.keys(PREFERENCIAS)) {
    const total = await prisma.digestPreference.count({ where: { roleName } });
    console.log(`  ${roleName}: ${total} tipos habilitados`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[digest-cx] error:", err);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
