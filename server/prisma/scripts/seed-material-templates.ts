// Siembra las plantillas de lista de materiales (Monofásico / Trifásico 230 /
// Trifásico 400) a partir del análisis del uso histórico. Idempotente: hace
// upsert de cada plantilla por `nombre` y reemplaza su set de ítems.
//
//   docker compose exec server npx tsx prisma/scripts/seed-material-templates.ts
//
// Resuelve cada ítem del catálogo por (categoría + nombre) NORMALIZADO
// (trim + lowercase), porque los nombres reales tienen espacios/mayúsculas
// inconsistentes. Los ítems que no matcheen se reportan y se saltean (no rompe).
//
// Corre contra la base apuntada por DATABASE_URL. En prod, correrlo después de
// `migrate deploy` (los material_items ya existen ahí). No otorga permisos:
// administrar = CONFIGURACION (ADMIN), aplicar = INGENIERIA/OPERACIONES.EDIT.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PhaseType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedItem {
  categoria: string;
  item: string;
}
interface SeedTemplate {
  nombre: string;
  descripcion: string;
  phaseType: keyof typeof PhaseType | null;
  items: SeedItem[];
}

const norm = (s: string) => s.trim().toLowerCase();
const keyOf = (categoria: string, item: string) => `${norm(categoria)}||${norm(item)}`;

async function main() {
  const dataPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "data",
    "material-templates.seed.json",
  );
  const templates = JSON.parse(readFileSync(dataPath, "utf-8")) as SeedTemplate[];

  // Índice del catálogo por (categoría + nombre) normalizado.
  const items = await prisma.materialItem.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, category: { select: { nombre: true } } },
  });
  const byKey = new Map<string, string>();
  for (const it of items) {
    const k = keyOf(it.category.nombre, it.nombre);
    if (!byKey.has(k)) byKey.set(k, it.id);
  }

  let orden = 0;
  for (const t of templates) {
    // Resolver ítems.
    const resolvedIds: string[] = [];
    const missing: string[] = [];
    for (const si of t.items) {
      const id = byKey.get(keyOf(si.categoria, si.item));
      if (id) resolvedIds.push(id);
      else missing.push(`${si.categoria} / ${si.item}`);
    }

    // Upsert de la plantilla.
    const phaseType = t.phaseType ? PhaseType[t.phaseType] : null;
    const tpl = await prisma.materialTemplate.upsert({
      where: { nombre: t.nombre },
      create: { nombre: t.nombre, descripcion: t.descripcion, phaseType, orden, activa: true },
      update: { descripcion: t.descripcion, phaseType, orden },
    });
    orden += 1;

    // Reemplazar el set de ítems (dedup ya garantizado por el análisis).
    await prisma.$transaction(async (tx) => {
      await tx.materialTemplateItem.deleteMany({ where: { templateId: tpl.id } });
      if (resolvedIds.length > 0) {
        await tx.materialTemplateItem.createMany({
          data: resolvedIds.map((materialItemId, idx) => ({
            templateId: tpl.id,
            materialItemId,
            quantity: 1,
            orden: idx,
          })),
        });
      }
    });

    console.log(
      `[seed-material-templates] "${t.nombre}": ${resolvedIds.length}/${t.items.length} ítems sembrados` +
        (missing.length ? ` — ${missing.length} sin match` : ""),
    );
    for (const m of missing) console.log(`    · sin match en catálogo: ${m}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
