/**
 * One-shot: habilita el módulo Capacitación.
 *
 * - `CAPACITACION:VIEW` para todos los roles internos (todos menos CLIENT).
 * - `CAPACITACION:EDIT` para ADMIN.
 * - Secciones iniciales (Ventas, Ingeniería y Tramitación, Operaciones,
 *   Experiencia Solar, Finanzas, Otros) con sus roles, SOLO si no hay ninguna.
 *
 * Idempotente: chequea antes de crear y NUNCA borra. Correr después de
 * `migrate deploy` (la migración agrega el valor al enum Module) y reiniciar el
 * server para invalidar la cache de permisos (5 min).
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/seed-capacitacion.ts
 */

import { prisma } from "../src/lib/prisma.js";
import { seedCapacitacion } from "../src/services/capacitacion/seed-capacitacion.js";

seedCapacitacion(prisma, console.log)
  .then(() => console.log("\nListo. Reiniciá el server para invalidar la cache de permisos."))
  .catch((error) => {
    console.error("Falló:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
