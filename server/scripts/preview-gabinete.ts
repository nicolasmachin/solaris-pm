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
  alaTapaCm: 3,
  radioDoblezMm: 2,
  union: "Dos piezas en L atornilladas",
  tornillos: "Tornillo punta mecha tipo T1",
  solapeUnionCm: 3,
  pasoTornillosCm: 15,
  agujeroAmureDiamMm: 6,
  agujerosAmureVertical: 4,
  agujerosAmureHorizontal: 3,
  perfilPuertaCm: 2,
  perfilMarcoCm: 2,
  solapePuertaCm: 1,
  holguraPuertaMm: 2,
  bisagrasCantidad: 2,
  bisagrasLado: "Izquierda",
  bisagraDistExtremoCm: 12,
  material: "Chapa galvanizada en caliente",
  espesorMm: 1.5,
  acabado: "Galvanizado",
  tipoCierre: "A presión (sin candado)",
  bisagras: "Ocultas (interior)",
  ventilacion: false,
  gradoIp: "IP54",
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
