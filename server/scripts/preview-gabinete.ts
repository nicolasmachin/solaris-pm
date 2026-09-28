// One-off: renderiza una lámina de gabinete de ejemplo a PNG para revisarla.
// Uso: docker compose exec server npx tsx scripts/preview-gabinete.ts /out.png
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { buildGabineteSvg, PAGE_W } from "../src/services/gabineteSvg/index.js";

const svg = buildGabineteSvg({
  titulo: "Gabinete metálico exterior con tapa",
  anchoCm: 50,
  altoCm: 85,
  profundidadCm: 26,
  fondoAbierto: true,
  pestanaAmure: true,
  pestanaAnchoCm: 3,
  alaTapaCm: null,
  union: "Dos piezas en L",
  tornillos: "Tornillo punta mecha tipo T1",
  perfilPuertaCm: 2,
  perfilMarcoCm: 2,
  solapePuertaCm: 1,
  holguraPuertaMm: 2,
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

const out = process.argv[2] ?? "/tmp/gabinete.png";
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: PAGE_W * 2 },
  font: { fontFiles: ["/app/src/services/unifilarSvg/fonts/Roboto-Regular.ttf", "/app/src/services/unifilarSvg/fonts/Roboto-Bold.ttf"], loadSystemFonts: false, defaultFontFamily: "Roboto" },
});
writeFileSync(out, resvg.render().asPng());
console.log("escrito:", out);
