// Trae el catálogo de materiales de producción a este entorno (uso local).
//
// Por qué: el catálogo de prod crece por su cuenta y en desarrollo faltan ítems.
// Para asociar fotos por `itemId` y que el manifiesto sirva en los dos lados,
// los ids tienen que coincidir, así que se copian tal cual.
//
// Es **solo de entrada**: no borra ni desactiva nada de este entorno, y no
// escribe una línea en producción (el JSON se exporta aparte, con un SELECT).
//
//   docker compose exec server npx tsx scripts/import-catalogo-prod.ts <archivo.json> [--dry-run]
//
// El JSON se genera con:
//   SELECT json_build_object('categorias', ..., 'suppliers', ..., 'items', ...);

import { promises as fs } from "node:fs";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Fila {
  [key: string]: unknown;
}

async function main() {
  const [archivo] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dryRun = process.argv.includes("--dry-run");
  if (!archivo) throw new Error("Falta la ruta del JSON exportado de producción");

  const data = JSON.parse(await fs.readFile(archivo, "utf8")) as {
    categorias: Fila[];
    suppliers: Fila[];
    items: Fila[];
  };

  const resumen = { categorias: 0, suppliers: 0, items: 0, actualizados: 0 };

  // 1. Categorías (los ítems dependen de ellas).
  for (const c of data.categorias) {
    const existe = await prisma.materialCategory.findUnique({ where: { id: c.id as string } });
    if (existe) continue;
    if (!dryRun) {
      await prisma.materialCategory.create({
        data: {
          id: c.id as string,
          nombre: c.nombre as string,
          descripcion: (c.descripcion as string | null) ?? null,
          orden: c.orden as number,
          activa: c.activa as boolean,
        },
      });
    }
    resumen.categorias++;
  }

  // 2. Proveedores: solo para no perder `defaultSupplierId` por falta de FK.
  for (const s of data.suppliers) {
    const existe = await prisma.supplier.findUnique({ where: { id: s.id as string } });
    if (existe) continue;
    if (!dryRun) {
      await prisma.supplier.create({
        data: {
          id: s.id as string,
          nombre: s.nombre as string,
          email: (s.email as string | null) ?? null,
          telefono: (s.telefono as string | null) ?? null,
          contactoNombre: (s.contactoNombre as string | null) ?? null,
          direccion: (s.direccion as string | null) ?? null,
          rut: (s.rut as string | null) ?? null,
          condicionPago: (s.condicionPago as string | null) ?? null,
          notas: (s.notas as string | null) ?? null,
          activo: s.activo as boolean,
          deletedAt: s.deletedAt ? new Date(s.deletedAt as string) : null,
        },
      });
    }
    resumen.suppliers++;
  }

  // 3. Ítems. Los que ya existen solo se actualizan en nombre/unidad/categoría —
  //    lo que hace falta para identificarlos al asignar fotos. Precios y stock
  //    NO se pisan: son datos de este entorno.
  for (const i of data.items) {
    const id = i.id as string;
    const existe = await prisma.materialItem.findUnique({ where: { id } });
    if (existe) {
      const cambia =
        existe.nombre !== (i.nombre as string) ||
        existe.unidad !== (i.unidad as string) ||
        existe.categoryId !== (i.categoryId as string);
      if (cambia) {
        if (!dryRun) {
          await prisma.materialItem.update({
            where: { id },
            data: {
              nombre: i.nombre as string,
              unidad: i.unidad as string,
              categoryId: i.categoryId as string,
            },
          });
        }
        resumen.actualizados++;
      }
      continue;
    }
    if (!dryRun) {
      await prisma.materialItem.create({
        data: {
          id,
          categoryId: i.categoryId as string,
          nombre: i.nombre as string,
          descripcion: (i.descripcion as string | null) ?? null,
          unidad: i.unidad as string,
          precioSugerido: (i.precioSugerido as string | null) ?? null,
          moneda: i.moneda as "USD" | "UYU",
          ivaTasa: (i.ivaTasa as number) ?? 22,
          defaultSupplierId: (i.defaultSupplierId as string | null) ?? null,
          activo: i.activo as boolean,
          gestionaStock: i.gestionaStock as boolean,
          stockActual: (i.stockActual as string) ?? 0,
          stockMinimo: (i.stockMinimo as string | null) ?? null,
          ubicacionDeposito: (i.ubicacionDeposito as string | null) ?? null,
        },
      });
    }
    resumen.items++;
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}categorías nuevas: ${resumen.categorias} · proveedores nuevos: ${resumen.suppliers} · ítems nuevos: ${resumen.items} · ítems renombrados/recategorizados: ${resumen.actualizados}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
