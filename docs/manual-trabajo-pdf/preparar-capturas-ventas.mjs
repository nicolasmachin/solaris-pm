// Las capturas del Manual de trabajo de Ventas (modo oscuro), llevadas al
// recorte y la medida con que entran en la maqueta. Los recortes están en px de
// las capturas de capturas-ventas.mjs (pantalla de 1440 de ancho a 2x; el
// Kanban a 1920 a 1.5x y el panel del lead a 1440×1700). Si una pantalla cambia
// de lugar las cosas, hay que volver a medirlos. Corre en el contenedor
// `server`, que tiene sharp:
//
//   docker compose cp <capturas> server:/tmp/cap/ventas
//   docker compose cp docs/manual-trabajo-pdf/preparar-capturas-ventas.mjs server:/app/prep-ventas.mjs
//   docker compose exec -T -w /app server node prep-ventas.mjs /tmp/cap/ventas /tmp/imgs-ventas
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [origen, destino] = process.argv.slice(2);
fs.mkdirSync(destino, { recursive: true });
const de = (n) => path.join(origen, `${n}.png`);
const jpg = (s) => s.jpeg({ quality: 84, mozjpeg: true });

const recortes = {
  "ventas-pipeline-kanban": ["ventas-pipeline-kanban", null],
  "ventas-pipeline-priorizada": ["ventas-pipeline-priorizada", { left: 0, top: 0, width: 2880, height: 1720 }],
  "ventas-tarjeta-lead": ["ventas-tarjeta-lead", { left: 0, top: 18, width: 540, height: 338 }],
  // El panel: la ventana del lead, de arriba hasta las fotos de la visita.
  "ventas-panel-lead": ["ventas-panel-lead", { left: 289, top: 170, width: 2302, height: 1955 }],
  "ventas-presentacion-es": ["ventas-panel-lead", { left: 328, top: 773, width: 1069, height: 463 }],
  "ventas-lista-propuestas": ["ventas-lista-propuestas", null],
  "ventas-armar-propuesta": ["ventas-armar-propuesta", { left: 144, top: 101, width: 2592, height: 1800 }],
  "ventas-crear-proyecto": ["ventas-crear-proyecto", { left: 929, top: 312, width: 1023, height: 1377 }],
  // El panel lateral de la etapa: las subetapas con una abierta, y la de modalidad de pago.
  "ventas-onboarding-subetapas": ["ventas-onboarding-subetapas", { left: 1440, top: 0, width: 1440, height: 1483 }],
  "ventas-modalidad-pago": ["ventas-modalidad-pago", { left: 1440, top: 936, width: 1440, height: 920 }],
  "ventas-consulta-ute": ["ventas-consulta-ute", { left: 0, top: 200, width: 2880, height: 1800 }],
  "ventas-contrato-firmado": ["ventas-contrato-firmado", { left: 486, top: 2109, width: 2346, height: 141 }],
};
for (const [n, [src, r]] of Object.entries(recortes)) {
  let s = sharp(de(src));
  if (r) s = s.extract(r);
  await jpg(s.resize(1600, null, { withoutEnlargement: true })).toFile(path.join(destino, `${n}.jpg`));
  console.log("  ✓", n);
}
