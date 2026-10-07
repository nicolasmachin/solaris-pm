// Abre la categoría "Electrica" en subcategorías y reasigna sus ítems.
//
//   docker compose exec server npx tsx prisma/scripts/seed-subcategorias-electrica.ts --dry-run
//   docker compose exec server npx tsx prisma/scripts/seed-subcategorias-electrica.ts
//
// Por qué: "Electrica" juntaba 175 de los 307 ítems del catálogo (cables,
// caños, térmicas, tableros, terminales, jabalinas). Con todo en una bolsa no
// se puede ofrecer "elegí el cable" sin recorrer el rubro entero, que es lo que
// hacía inusable la carga de la lista de materiales.
//
// La clasificación es por patrón sobre el nombre, en ORDEN: gana la primera
// regla que matchea. Está pensada para el catálogo real de Voltia; los ítems
// que no matchean ninguna regla caen en "Fijación y varios" y se reportan al
// final, para revisarlos a mano.
//
// Es idempotente: crea las subcategorías que falten y solo mueve los ítems que
// todavía cuelgan del rubro padre. Un ítem ya movido a mano a otra subcategoría
// NO se toca.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RUBRO = "Electrica";

/** Orden importante: gana la primera que matchea. */
const SUBCATEGORIAS: { nombre: string; descripcion: string; test: (n: string) => boolean }[] = [
  {
    nombre: "Cables",
    descripcion: "Cables solares, multifilares, superplásticos y de acometida",
    test: (n) => n.startsWith("cable") || n.includes("preensamblado"),
  },
  {
    nombre: "Canalización",
    descripcion: "Caños, codos, cuplas, grampas, bandejas, cámaras y cajas de registro",
    test: (n) =>
      n.includes("caño") ||
      n.includes("codo") ||
      n.includes("cupla") ||
      n.includes("bandeja") ||
      n.includes("curva") ||
      n.includes("subida/bajada") ||
      n.includes("camara de registro") ||
      n.includes("ducto") ||
      n.includes("caja ciega") ||
      n.includes("grampa") ||
      n.includes("flexible") ||
      n.includes("corrugado") ||
      n.includes("conector p/ca") ||
      n.includes("conector para flexible"),
  },
  {
    nombre: "Protecciones",
    descripcion: "Termomagnéticas, diferenciales, descargadores, fusibles y seccionadores DC",
    test: (n) =>
      n.includes("termomagn") ||
      n.includes("diferencial") ||
      n.includes("descargador") ||
      n.includes("fusible") ||
      n.includes("interruptor dc") ||
      n.includes("sobretension"),
  },
  {
    nombre: "Tableros y gabinetes",
    descripcion: "Tableros estancos y de distribución, nichos y cajones",
    test: (n) => n.includes("tablero") || n.includes("nicho") || n.includes("cajon"),
  },
  {
    nombre: "Terminales y conexionado",
    descripcion: "Terminales, borneras, conectores MC4, prensaestopas y termocontraíbles",
    test: (n) =>
      n.includes("terminal") ||
      n.includes("bornera") ||
      n.includes("mc4") ||
      n.includes("prensaestopa") ||
      n.includes("termocontra") ||
      n.includes("morceto") ||
      n.includes("conector ro"),
  },
  {
    nombre: "Puesta a tierra",
    descripcion: "Jabalinas, barras de cobre, aisladores y accesorios de tierra",
    test: (n) =>
      n.includes("jabalina") ||
      n.includes("tierra") ||
      n.includes("cobre") ||
      n.includes("aislador") ||
      n.includes("antioxidante"),
  },
  {
    // Último: cajón de sastre, a propósito. Lo que cae acá se reporta.
    nombre: "Fijación y varios",
    descripcion: "Precintos, fleje, riel DIN, soportes y accesorios sueltos",
    test: () => true,
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const rubro = await prisma.materialCategory.findFirst({ where: { nombre: RUBRO } });
  if (!rubro) {
    console.error(`No existe la categoría "${RUBRO}". Nada que hacer.`);
    return;
  }

  // 1. Crear las subcategorías que falten, colgando del rubro.
  const subIds = new Map<string, string>();
  for (const [i, sub] of SUBCATEGORIAS.entries()) {
    const existente = await prisma.materialCategory.findFirst({ where: { nombre: sub.nombre } });
    if (existente) {
      subIds.set(sub.nombre, existente.id);
      // Si existía suelta (sin padre), engancharla.
      if (existente.parentId !== rubro.id && !dryRun) {
        await prisma.materialCategory.update({
          where: { id: existente.id },
          data: { parentId: rubro.id, orden: i },
        });
      }
      continue;
    }
    if (dryRun) {
      subIds.set(sub.nombre, `(nueva) ${sub.nombre}`);
      continue;
    }
    const creada = await prisma.materialCategory.create({
      data: {
        nombre: sub.nombre,
        descripcion: sub.descripcion,
        parentId: rubro.id,
        orden: i,
      },
    });
    subIds.set(sub.nombre, creada.id);
  }

  // 2. Reasignar los ítems que todavía cuelgan del rubro padre.
  const items = await prisma.materialItem.findMany({
    where: { categoryId: rubro.id },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const resumen = new Map<string, string[]>();
  for (const item of items) {
    const n = item.nombre.trim().toLowerCase();
    const sub = SUBCATEGORIAS.find((s) => s.test(n))!;
    if (!resumen.has(sub.nombre)) resumen.set(sub.nombre, []);
    resumen.get(sub.nombre)!.push(item.nombre);

    if (!dryRun) {
      await prisma.materialItem.update({
        where: { id: item.id },
        data: { categoryId: subIds.get(sub.nombre)! },
      });
    }
  }

  console.log(dryRun ? "— SIMULACIÓN, no se escribió nada —\n" : "— Aplicado —\n");
  for (const sub of SUBCATEGORIAS) {
    const lista = resumen.get(sub.nombre) ?? [];
    console.log(`${sub.nombre}: ${lista.length}`);
  }
  console.log(`\nTotal reasignados: ${items.length}`);

  const varios = resumen.get("Fijación y varios") ?? [];
  if (varios.length > 0) {
    console.log(`\nRevisar a mano (cayeron en "Fijación y varios"):`);
    for (const nombre of varios) console.log(`  · ${nombre}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
