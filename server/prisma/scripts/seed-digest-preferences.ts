// Siembra las preferencias del resumen diario (digest) SIN correr el seed
// completo. Modelo opt-in: por defecto un rol no recibe ningún tipo. Para que el
// digest no arranque en cero tras el deploy, se habilita TODO al rol ADMIN
// (mantienen la visibilidad que tenían); el resto de los roles arranca vacío y
// se configura desde Administración → Resumen diario. Idempotente.
//
//   docker compose exec server npx tsx prisma/scripts/seed-digest-preferences.ts

import { NotificationType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALL_TYPES = Object.values(NotificationType);
const SEED_ROLE = "ADMIN";

export async function seedDigestPreferences(client: PrismaClient = prisma): Promise<number> {
  let created = 0;
  for (const notificationType of ALL_TYPES) {
    const existing = await client.digestPreference.findUnique({
      where: { roleName_notificationType: { roleName: SEED_ROLE, notificationType } },
    });
    if (existing) continue;
    await client.digestPreference.create({ data: { roleName: SEED_ROLE, notificationType } });
    created++;
  }
  return created;
}

if (process.argv[1] && process.argv[1].endsWith("seed-digest-preferences.ts")) {
  seedDigestPreferences()
    .then((n) => {
      console.log(`[seed-digest-preferences] preferencias ADMIN creadas: ${n} (existentes respetadas)`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
