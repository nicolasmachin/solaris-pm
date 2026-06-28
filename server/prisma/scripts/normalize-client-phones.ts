// Normaliza los teléfonos de clientes (Project.clientPhone) a formato uruguayo
// canónico: 9 dígitos "09" + 7. Reglas:
//   - Saca espacios y separadores (espacios, guiones, paréntesis, puntos).
//   - Saca el código de país +598 (o 00598 / 598) y antepone "0".
//   - Si queda un móvil de 8 dígitos que arranca en "9" (sin 0), antepone "0".
//
// Defensivo: solo actualiza si el resultado es un 09+7 válido. Si un valor no
// normaliza, lo SALTEA con warning (no pisa con basura). Idempotente.
//
// Uso:
//   docker compose exec server npx tsx prisma/scripts/normalize-client-phones.ts
//   # dry-run (no escribe, solo muestra): DRY_RUN=1 npx tsx prisma/scripts/normalize-client-phones.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1";

// Devuelve el teléfono normalizado, o null si no se puede llevar al formato 09+7.
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("+598")) s = s.slice(4);
  else if (s.startsWith("00598")) s = s.slice(5);
  else if (s.startsWith("598") && s.length === 11) s = s.slice(3);

  // Móvil de 8 dígitos sin el 0 inicial → anteponer "0".
  if (/^9\d{7}$/.test(s)) s = "0" + s;

  return /^09\d{7}$/.test(s) ? s : null;
}

async function main() {
  const projects = await prisma.project.findMany({
    where: { clientPhone: { not: null } },
    select: { id: true, clientName: true, clientPhone: true },
  });

  let cambiados = 0;
  let sinCambio = 0;
  const noNormalizables: Array<{ cliente: string; valor: string }> = [];

  for (const p of projects) {
    const raw = (p.clientPhone ?? "").trim();
    if (!raw) continue;

    const norm = normalizePhone(raw);
    if (norm === null) {
      noNormalizables.push({ cliente: p.clientName, valor: raw });
      continue;
    }
    if (norm === raw) {
      sinCambio++;
      continue;
    }

    console.log(`  ${p.clientName}: "${raw}" → "${norm}"`);
    if (!DRY_RUN) {
      await prisma.project.update({ where: { id: p.id }, data: { clientPhone: norm } });
    }
    cambiados++;
  }

  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Resumen:`);
  console.log(`  Cambiados:   ${cambiados}`);
  console.log(`  Ya OK:       ${sinCambio}`);
  if (noNormalizables.length > 0) {
    console.log(`  ⚠️  No normalizables (NO se tocaron) — revisar a mano:`);
    for (const n of noNormalizables) console.log(`     - ${n.cliente}: "${n.valor}"`);
  } else {
    console.log(`  Sin casos raros: todos los teléfonos quedaron en formato 09+7.`);
  }
}

main()
  .catch((e) => {
    console.error("Error normalizando teléfonos:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
