// One-off: renderiza las hojas de una lámina de gabinete a PNG para revisarlas.
// Uso: docker compose exec server npx tsx scripts/preview-gabinete.ts /tmp/gab
//      (escribe /tmp/gab-1.png, /tmp/gab-2.png)
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { buildGabineteSvgs, PAGE_W } from "../src/services/gabineteSvg/index.js";

const hojas = buildGabineteSvgs({
  titulo: "Gabinete metálico exterior con tapa",
  anchoCm: 50,
  altoCm: 85,
  profundidadCm: 26,
  fondoAbierto: true,
  pestanaAmure: true,
  pestanaAnchoCm: 3,
  union: "Dos piezas en L atornilladas",
  tornillos: "Tornillo punta mecha tipo T1",
  solapeUnionCm: 3,
  pasoTornillosCm: 15,
  rebordeTapaCm: 2,
  rebordeFrenteCm: 2,
  solapeTapaCm: 1,
  holguraTapaMm: 2,
  material: "Chapa galvanizada en caliente",
  espesorMm: 1.5,
  acabado: "Galvanizado",
  toleranciaMm: 2,
  cantidad: 3,
  notas: null,
  specsExtra: [],
  cliente: "Juan Pérez",
  proyectoCodigo: "PRY-0123",
  fecha: "28 de septiembre de 2026",
  contacto: { nombre: "Nicolás Machin", telefono: "099 123 456", email: "nicolas@voltia.com.uy" },
});

const base = process.argv[2] ?? "/tmp/gab";
const fonts = [
  "/app/src/services/unifilarSvg/fonts/Roboto-Regular.ttf",
  "/app/src/services/unifilarSvg/fonts/Roboto-Bold.ttf",
];
hojas.forEach((svg, i) => {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: PAGE_W * 2 },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Roboto" },
  });
  const out = `${base}-${i + 1}.png`;
  writeFileSync(out, resvg.render().asPng());
  console.log("escrito:", out);
});
