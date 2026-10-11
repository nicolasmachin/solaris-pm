// Las capturas de Voltia PM del PGT y del Manual de trabajo de Operaciones,
// en modo oscuro (pedido de Nicolás, 11-oct-2026), llevadas a la medida y al
// recorte con que entran en la maqueta. Los recortes se midieron sobre las
// capturas de capturas.mjs y capturas-operaciones.mjs (pantalla de 1440×1000 a
// 2x); si una pantalla cambia de lugar las cosas, hay que volver a medirlos.
// Corre en el contenedor `server`, que tiene sharp:
//
//   docker compose cp <capturas de capturas-operaciones.mjs> server:/tmp/cap/ops
//   docker compose cp <capturas de capturas.mjs> server:/tmp/cap/tr
//   docker compose cp <imágenes ya preparadas del de Posventa> server:/tmp/cap/pv-listas
//   docker compose cp docs/manual-trabajo-pdf/preparar-capturas-oscuras.mjs server:/app/prep-oscuras.mjs
//   docker compose exec -T -w /app server node prep-oscuras.mjs /tmp/cap /tmp/imgs-oscuras
//
// Las del capítulo 7 del PGT llevan números encima, ubicados en porcentaje de
// la imagen (PANTALLAS en contenido.py): un recorte nuevo los corre de lugar.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [origen, destino] = process.argv.slice(2);
fs.mkdirSync(destino, { recursive: true });

const ops = (n) => path.join(origen, "ops", `${n}.png`);
const sale = (n) => path.join(destino, n);
const jpg = (s) => s.jpeg({ quality: 82, mozjpeg: true });

// 1. Operaciones: pantallas enteras, a 1600 de ancho.
for (const n of ["ops-calendario-mes", "ops-calendario-detalle", "ops-lista-proyectos", "ops-pagos-instalador",
  "ops-proyecto-encabezado", "ops-proyecto-recorrido", "ops-proyecto-documentos-ute"]) {
  await jpg(sharp(ops(n)).resize(1600, null, { withoutEnlargement: true })).toFile(sale(`${n}.jpg`));
}

// 2. Operaciones: recortes (en px de la captura a 2x).
const recortes = {
  // El panel lateral de cada etapa, de arriba hasta el final de las subetapas.
  "ops-panel-validacion": [ops("ops-panel-validacion"), { left: 1440, top: 0, width: 1440, height: 1440 }],
  "ops-panel-compras": [ops("ops-panel-compras"), { left: 1440, top: 0, width: 1440, height: 990 }],
  "ops-panel-obra": [ops("ops-panel-obra"), { left: 1440, top: 0, width: 1440, height: 980 }],
  // Los diálogos, sin la pantalla de atrás.
  "ops-checklist-fotos": [ops("ops-checklist-fotos"), { left: 760, top: 140, width: 1360, height: 1720 }],
  "ops-calendario-reprogramar": [ops("ops-calendario-reprogramar"), { left: 952, top: 600, width: 976, height: 800 }],
  // Las pestañas de abajo del proyecto, sin la lista de clientes de la izquierda.
  "ops-pestana-compras": [ops("ops-pestana-compras"), { left: 470, top: 0, width: 2410, height: 1800 }],
  "ops-pestana-materiales": [ops("ops-pestana-materiales"), { left: 470, top: 0, width: 2410, height: 1800 }],
  "ops-pestana-costos": [ops("ops-pestana-costos"), { left: 470, top: 0, width: 2410, height: 1800 }],
  "ops-pestana-comentarios": [ops("ops-pestana-comentarios"), { left: 470, top: 0, width: 2410, height: 1800 }],
  // La sección Obra del proyecto, en dos: la cabecera de las fotos, y videos + checklist.
  "ops-obra-fotos": [ops("ops-proyecto-obra"), { left: 0, top: 0, width: 2392, height: 504 }],
  "ops-obra-videos-checklist": [ops("ops-proyecto-obra"), { left: 0, top: 3320, width: 2392, height: 1480 }],
};
for (const [n, [src, r]] of Object.entries(recortes)) {
  await jpg(sharp(src).extract(r).resize(1600, null, { withoutEnlargement: true })).toFile(sale(`${n}.jpg`));
}

// 3. El PGT: el proyecto y el calendario enteros, y la parte de arriba del
//    portal (ya sin la banda de aviso, la prepara el de Posventa).
await sharp(path.join(origen, "tr", "proyecto.png")).resize(1400).png({ compressionLevel: 9 }).toFile(sale("proyecto-pantalla.png"));
await sharp(path.join(origen, "tr", "calendario-con-obras.png")).resize(1400).png({ compressionLevel: 9 }).toFile(sale("calendario-con-obras.png"));
const portal = path.join(origen, "pv-listas", "portal-cliente.png");
await sharp(portal).extract({ left: 0, top: 0, width: 1400, height: 820 }).png({ compressionLevel: 9 }).toFile(sale("portal-recorte.png"));
for (const n of ["ficha-encabezado.png", "portal-cliente.png", "plantillas.png", "tramite-ute.png", "calendario.png"]) {
  fs.copyFileSync(path.join(origen, "pv-listas", n), sale(n));
}

for (const f of fs.readdirSync(destino).sort()) {
  const m = await sharp(path.join(destino, f)).metadata();
  const kb = Math.round(fs.statSync(path.join(destino, f)).size / 1024);
  console.log(`${f.padEnd(32)} ${m.width}×${m.height}  ${kb} KB`);
}
