// Crea la plantilla de materiales "Base" y desactiva las viejas por tipo de
// conexión (Monofásico / Trifásico 230 / Trifásico 400).
//
//   docker compose exec server npx tsx prisma/scripts/seed-plantilla-base.ts --dry-run
//   docker compose exec server npx tsx prisma/scripts/seed-plantilla-base.ts
//
// Si falta algún ítem en el catálogo, aborta sin tocar nada. --skip-missing
// los saltea (sirve en local, donde el catálogo puede estar atrasado vs prod).
//
// Por qué (7-oct-2026): las plantillas viejas salieron del promedio del uso
// histórico y cargaban cantidades que siempre había que corregir. Además, lo
// que cambia entre monofásico y trifásico es casi siempre la misma pieza en
// otra medida (diferencial 2P/4P, descargador 2P/3P/4P, medidor mono/tri), que
// en la lista se resuelve cambiando la variante del renglón. Entonces: UNA
// plantilla con lo que siempre va, todo en cantidad cero.
//
// El contenido sale de las 37 obras con lista en prod: entra lo que aparece en
// la mitad o más, con la variante más usada. Quedan afuera el inversor (cambia
// en cada obra) y la estructura que depende del techo (perfiles, punta mecha,
// anclajes, losas), que se carga por sección.
//
// Además ordena dos cosas del catálogo que la plantilla necesita:
//   - Medidores, dongles y Shine pasan a "Monitoreo y medición": estaban
//     repartidos entre "Inversores Monofasicos" y "Trifasicos", y el cambio de
//     variante solo ofrece ítems del mismo grupo (SPM mono ⇄ TPM tri).
//   - La jabalina pasa de "Terminales y conexionado" a "Puesta a tierra".
//
// Es idempotente: si "Base" ya existe le reemplaza los renglones (la deja como
// dice este archivo); los movimientos de categoría solo tocan lo que falte.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");
const SKIP_MISSING = process.argv.includes("--skip-missing");

const NOMBRE = "Base";
const DESCRIPCION =
  "Lo que siempre va, con cantidad en cero para completar. Lo que depende de la obra (2P o 4P, 1\" o 1¼\") se cambia en cada renglón.";
const VIEJAS = ["Monofásico (MONO 230)", "Trifásico 230 (TRI 230 SN)", "Trifásico 400 (TRI 400 CN)"];

/** Nombres del catálogo de prod; se comparan sin mayúsculas ni espacios. */
const ITEMS = [
  // Paneles y monitoreo
  "Paneles Resun 590 W",
  "Shine WiFi-X",
  "SPM Smart Meter Mono Growatt",
  // Cables
  "Cable solar ROJO 4mm",
  "Cable solar NEGRO 4mm",
  "Cable Multifilar Tierra 4 mm",
  "Cable Multifilar Tierra 6mm",
  "Cable UTP exterior",
  "Cable Multifilar Blanco 6mm",
  "Cable Multifilar Celeste 6mm",
  "Cable Superplastico 2x6 mm",
  // Canalización
  "Caja ciega de registro 12x16",
  "Camara de registro con tapa 20x20cm",
  'CAÑO GALVANIZADO 1" 1/4 X 3 MTS',
  'CODO GALVANIZADO 1" 1/4',
  'CUPLA GALVANIZADA 1" 1/4',
  "Conector p/caño metalico 1'' 1/4 c/arandela rosca",
  "Grampa p/caño metalico 1'' 1/4 c/tapa",
  "Caño flexible metalico 1'' 1/4",
  "Conector para flexible metalico 1'' 1/4",
  // Protecciones
  "Disyuntor Diferencial 40A 300mA 2P",
  "Interruptor Termomagnético 32A 2P",
  "Interruptor DC 16A",
  "DESCARGADOR ATMOSFERICO AC - 2P",
  "DESCARGADOR ATMOSFERICO DC - 2P - 600V",
  // Tableros
  "Tablero estanco IP65 12 Modulos",
  "Tablero estanco IP65 8 Modulos",
  // Terminales y tierra
  "Conector MC4 Macho-Hembra",
  "Bornera PAT (Tierra) 7 tornillos RIEL DIN",
  "BORNERA CAJA DE TERMINALES 2P Monofasica",
  "Terminal Pino 6mm",
  "Terminal Pino Doble 6mm",
  "Terminal Pino 10mm",
  "Terminal Ojal 4mm",
  "Jabalina c/morceto",
  "Tornillo c/arandela y tuerca p/Tierra",
  // Fijación y otros
  "Precintos 30 cm (x100u)",
  "PG varios",
  "Taco de 8 c/tornillo",
  "SUJETADOR FINAL de Paneles",
  "SUJETADOR INTERMEDIO de Paneles",
  "Sellador PU",
  "Documentos de UTE",
  "Precintos de seguridad c/bloqueo de llave",
];

const MONITOREO = {
  nombre: "Monitoreo y medición",
  descripcion: "Medidores inteligentes, dongles y módulos de comunicación del inversor",
  test: (n: string) => n.includes("smart meter") || n.includes("dongle") || n.startsWith("shine"),
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** Para matchear nombres: el catálogo tiene "Tierra 4 mm" y "Tierra 4mm" según la carga. */
const key = (s: string) => s.toLowerCase().replace(/\s+/g, "");

async function main() {
  console.log(DRY ? "── DRY RUN: no se escribe nada ──\n" : "");

  const catalog = await prisma.materialItem.findMany({
    where: { activo: true },
    select: {
      id: true, nombre: true, createdAt: true, categoryId: true,
      category: { select: { nombre: true } },
      _count: { select: { projectMaterials: true } },
    },
  });

  // 1) Resolver los nombres. Si un nombre está repetido en el catálogo se usa
  //    el más usado en obras (y se avisa: hay que unificarlos a mano).
  const resolved: { id: string; nombre: string; categoria: string }[] = [];
  const faltan: string[] = [];
  for (const nombre of ITEMS) {
    const matches = catalog
      .filter((i) => key(i.nombre) === key(nombre))
      .sort((a, b) => b._count.projectMaterials - a._count.projectMaterials || +a.createdAt - +b.createdAt);
    if (matches.length === 0) { faltan.push(nombre); continue; }
    if (matches.length > 1) {
      console.log(`⚠ "${nombre}" está ${matches.length} veces en el catálogo; uso el más usado (${matches[0].id}, ${matches[0]._count.projectMaterials} obras).`);
    }
    resolved.push({ id: matches[0].id, nombre: matches[0].nombre, categoria: matches[0].category.nombre });
  }
  if (faltan.length > 0) {
    console.error(`${SKIP_MISSING ? "⚠" : "✗"} No están en el catálogo (o están inactivos):\n  - ${faltan.join("\n  - ")}`);
    if (!SKIP_MISSING) process.exit(1);
  }

  // 2) Categoría "Monitoreo y medición" (rubro de primer nivel).
  const monitoreoItems = catalog.filter((i) => MONITOREO.test(norm(i.nombre)));
  let monitoreo = await prisma.materialCategory.findUnique({ where: { nombre: MONITOREO.nombre } });
  const aMoverMonitoreo = monitoreoItems.filter((i) => i.categoryId !== monitoreo?.id);
  console.log(`\nMonitoreo y medición: ${monitoreo ? "ya existe" : "se crea"}; ${aMoverMonitoreo.length} ítem(s) a mover:`);
  for (const i of aMoverMonitoreo) console.log(`  - ${i.nombre}  (estaba en ${i.category.nombre})`);
  if (!DRY) {
    if (!monitoreo) {
      const inversores = await prisma.materialCategory.findFirst({ where: { nombre: "Inversores" } });
      monitoreo = await prisma.materialCategory.create({
        data: { nombre: MONITOREO.nombre, descripcion: MONITOREO.descripcion, orden: inversores?.orden ?? 1 },
      });
    }
    if (aMoverMonitoreo.length > 0) {
      await prisma.materialItem.updateMany({
        where: { id: { in: aMoverMonitoreo.map((i) => i.id) } },
        data: { categoryId: monitoreo.id },
      });
    }
  }

  // 3) Jabalina → Puesta a tierra (solo si sigue en Terminales y conexionado).
  const pat = await prisma.materialCategory.findUnique({ where: { nombre: "Puesta a tierra" } });
  const jabalinas = catalog.filter(
    (i) => norm(i.nombre).includes("jabalina") && i.category.nombre === "Terminales y conexionado",
  );
  if (pat && jabalinas.length > 0) {
    console.log(`\nA "Puesta a tierra": ${jabalinas.map((j) => j.nombre).join(", ")}`);
    if (!DRY) {
      await prisma.materialItem.updateMany({ where: { id: { in: jabalinas.map((j) => j.id) } }, data: { categoryId: pat.id } });
    }
  }

  // 4) Plantilla "Base", todo en cero.
  const existente = await prisma.materialTemplate.findUnique({ where: { nombre: NOMBRE } });
  console.log(`\nPlantilla "${NOMBRE}": ${existente ? "existe, se reemplazan sus renglones" : "se crea"} con ${resolved.length} renglones en cero.`);
  for (const r of resolved) console.log(`  - ${r.nombre}`);

  const viejas = await prisma.materialTemplate.findMany({ where: { nombre: { in: VIEJAS }, activa: true } });
  console.log(`\nSe desactivan: ${viejas.length ? viejas.map((v) => v.nombre).join(", ") : "(ninguna activa)"}`);

  if (DRY) return;

  await prisma.$transaction(async (tx) => {
    const base =
      existente ??
      (await tx.materialTemplate.create({ data: { nombre: NOMBRE, descripcion: DESCRIPCION, orden: 0, activa: true } }));
    await tx.materialTemplate.update({ where: { id: base.id }, data: { descripcion: DESCRIPCION, activa: true, phaseType: null } });
    await tx.materialTemplateItem.deleteMany({ where: { templateId: base.id } });
    await tx.materialTemplateItem.createMany({
      data: resolved.map((r, idx) => ({ templateId: base.id, materialItemId: r.id, quantity: 0, orden: idx })),
    });
    // Desactivar y no borrar: si alguien las necesita, se reactivan desde Admin.
    await tx.materialTemplate.updateMany({ where: { id: { in: viejas.map((v) => v.id) } }, data: { activa: false } });
  });
  console.log("\n✓ Listo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
