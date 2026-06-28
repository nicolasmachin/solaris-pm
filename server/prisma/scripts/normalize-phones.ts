// Normaliza Project.clientPhone al formato canónico uruguayo "09" + 7 dígitos.
// Idempotente y prod-safe: por defecto corre en DRY-RUN (no escribe); solo
// aplica con el flag --apply.
//
// Reglas (en orden):
//   a. Si ya matchea ^09\d{7}$ → OK_skip (no toca).
//   b. Saca todos los espacios.
//   c. Si arranca con +598 (o 00598 / 598+8díg) → saca el código de país.
//   d. Si queda en 9 + 7 dígitos (8 díg, sin 0 inicial) → antepone "0".
//   e. Si tras todo NO matchea ^09\d{7}$ → NO_NORMALIZABLE (no toca, se lista).
//
// Uso:
//   docker compose exec server npx tsx prisma/scripts/normalize-phones.ts          # dry-run
//   docker compose exec server npx tsx prisma/scripts/normalize-phones.ts --apply  # aplica

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Accion = "OK_skip" | "A_normalizar" | "NO_NORMALIZABLE";

const CANON = /^09\d{7}$/;

function normalizar(raw: string): { value: string; accion: Accion } {
  if (CANON.test(raw)) return { value: raw, accion: "OK_skip" };
  let s = raw.replace(/\s+/g, "");
  if (s.startsWith("+598")) s = s.slice(4);
  else if (s.startsWith("00598")) s = s.slice(5);
  else if (s.startsWith("598") && s.length === 11) s = s.slice(3);
  if (/^9\d{7}$/.test(s)) s = "0" + s;
  if (CANON.test(s)) return { value: s, accion: "A_normalizar" };
  return { value: raw, accion: "NO_NORMALIZABLE" };
}

async function main() {
  const rows = await prisma.project.findMany({
    where: { deletedAt: null, clientPhone: { not: null } },
    select: { id: true, clientName: true, clientPhone: true },
  });

  const items = rows
    .map((r) => ({ ...r, raw: (r.clientPhone ?? "").trim() }))
    .filter((r) => r.raw !== "")
    .map((r) => ({ ...r, ...normalizar(r.raw) }));

  console.log(`Modo: ${APPLY ? "APPLY (escribe)" : "DRY-RUN (no escribe)"}\n`);
  console.log("projectId | clientName | actual -> normalizado | accion");
  console.log("-".repeat(90));
  for (const it of items) {
    const flecha = it.accion === "A_normalizar" ? `"${it.raw}" -> "${it.value}"` : `"${it.raw}"`;
    console.log(`${it.id} | ${it.clientName} | ${flecha} | ${it.accion}`);
  }

  const aNormalizar = items.filter((i) => i.accion === "A_normalizar");
  const okSkip = items.filter((i) => i.accion === "OK_skip");
  const noNorm = items.filter((i) => i.accion === "NO_NORMALIZABLE");

  // Duplicados con el valor FINAL (tras normalizar): mismo número en >1 proyecto.
  const byFinal = new Map<string, Array<{ id: string; clientName: string }>>();
  for (const it of items) {
    const final = it.accion === "NO_NORMALIZABLE" ? it.raw : it.value;
    if (!byFinal.has(final)) byFinal.set(final, []);
    byFinal.get(final)!.push({ id: it.id, clientName: it.clientName });
  }
  const duplicados = [...byFinal.entries()].filter(([, list]) => list.length > 1);

  console.log("\n── Resumen ──");
  console.log(`A_normalizar:    ${aNormalizar.length}`);
  console.log(`OK_skip:         ${okSkip.length}`);
  console.log(`NO_NORMALIZABLE: ${noNorm.length}`);
  if (noNorm.length > 0) {
    console.log("\n⚠️  NO_NORMALIZABLE (no se tocan, revisar a mano):");
    for (const n of noNorm) console.log(`   - ${n.clientName}: "${n.raw}"  (${n.id})`);
  }
  if (duplicados.length > 0) {
    console.log("\nℹ️  Duplicados tras normalizar (mismo número en varios proyectos):");
    for (const [num, list] of duplicados) {
      console.log(`   ${num}: ${list.map((p) => p.clientName).join(" | ")}`);
    }
  }

  if (APPLY) {
    let updated = 0;
    for (const it of aNormalizar) {
      await prisma.project.update({ where: { id: it.id }, data: { clientPhone: it.value } });
      updated++;
    }
    console.log(`\n✅ APPLY: ${updated} teléfono(s) normalizado(s).`);
  } else {
    console.log("\n(DRY-RUN: no se escribió nada. Para aplicar: agregar --apply.)");
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
