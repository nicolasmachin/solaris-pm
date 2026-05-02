// Smoke test del generador de unifilares: corre los 3 casos canónicos del
// SPEC sec. 9 y guarda los SVG resultantes en /tmp/unifilar-*.svg para
// validación visual contra los planos de referencia.
//
// Correr: docker compose exec server node --import tsx scripts/smoke-unifilar.ts

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateUnifilarSvg, type UnifilarInputs } from "../src/services/unifilarSvg/index.js";

const cases: Array<{ name: string; inputs: UnifilarInputs }> = [
  {
    name: "caso_A_mezquita",
    inputs: {
      cliente: "Fabian Mezquita",
      ubicacion: "Camino Ariel 5821, Montevideo",
      fecha: "Abril 2025",
      autor: "Nicolás Machín — Voltia",
      tipoRed: "MONO_230",
      cantidadPaneles: 10,
      potenciaPanelW: 580,
      cantidadStrings: 2,
      potenciaContratadaKw: 7.0,
      modeloInversor: "Growatt MIN 6000 TL-X",
      potenciaInversorKw: 6.0,
      tipoProteccionDc: "TERMOMAGNETICO",
      calibreProteccionDc: "25A 2P",
      largoDcPanelesM: 15,
      largoDcEsLargo: false,
      largoAcInversorIcpM: 10,
      largoAcIcpTableroM: 10,
    },
  },
  {
    name: "caso_B_trifasico",
    inputs: {
      cliente: "Cliente Industrial S.A.",
      ubicacion: "Las Piedras, Canelones",
      fecha: "Mayo 2026",
      autor: "Nicolás Machín — Voltia",
      tipoRed: "TRI_400_CN",
      cantidadPaneles: 30,
      potenciaPanelW: 580,
      cantidadStrings: 3,
      potenciaContratadaKw: 20.0,
      modeloInversor: "Growatt MID 17 KTL3-X",
      potenciaInversorKw: 17.0,
      tipoProteccionDc: "TERMOMAGNETICO",
      calibreProteccionDc: "25A 4P",
      largoDcPanelesM: 8,
      largoDcEsLargo: false,
      largoAcInversorIcpM: 25,
      largoAcIcpTableroM: 15,
    },
  },
  {
    name: "caso_C_fusibles",
    inputs: {
      cliente: "Cliente con Fusibles",
      ubicacion: "Pocitos, Montevideo",
      fecha: "Mayo 2026",
      autor: "Nicolás Machín — Voltia",
      tipoRed: "MONO_230",
      cantidadPaneles: 12,
      potenciaPanelW: 580,
      cantidadStrings: 2,
      potenciaContratadaKw: 8.0,
      modeloInversor: "Growatt MIN 8000 TL-X",
      potenciaInversorKw: 8.0,
      tipoProteccionDc: "FUSIBLE",
      calibreProteccionDc: "20A gPV",
      largoDcPanelesM: 20,
      largoDcEsLargo: true,
      largoAcInversorIcpM: 20,
      largoAcIcpTableroM: 20,
    },
  },
];

const outDir = "/tmp";
console.log("=== Smoke test generador de unifilares ===\n");

for (const c of cases) {
  const svg = generateUnifilarSvg(c.inputs);
  const path = join(outDir, `unifilar-${c.name}.svg`);
  writeFileSync(path, svg, "utf8");
  console.log(`  ✓ ${c.name.padEnd(20)} → ${path} (${svg.length} bytes)`);

  // Verificaciones críticas (sec. 9 spec)
  if (c.name === "caso_A_mezquita") {
    if (!svg.includes("2x6 PVC 10m")) console.log("    ⚠  no encuentra 2x6 PVC 10m (cable AC inversor→ICP)");
    if (!svg.includes("1~")) console.log("    ⚠  no encuentra marca 1~ en inversor mono");
    if (!svg.includes("40A 300mA")) console.log("    ⚠  no encuentra diferencial 40A 300mA");
  }
  if (c.name === "caso_B_trifasico") {
    if (!svg.includes("4x10")) console.log("    ⚠  no encuentra 4x10 (tri con neutro)");
    if (!svg.includes("3~")) console.log("    ⚠  no encuentra marca 3~ en inversor tri");
    if (!svg.includes("80A 300mA")) console.log("    ⚠  no encuentra diferencial 80A 300mA");
  }
  if (c.name === "caso_C_fusibles") {
    if (!svg.includes("Portafusibles DC")) console.log("    ⚠  no encuentra Portafusibles DC");
    if (!svg.includes("2x6 solar")) console.log("    ⚠  no encuentra 2x6 solar (DC tramo largo)");
  }
}

console.log("\nPara validar: copiar los SVG fuera del container y abrirlos en navegador:");
console.log("  docker compose cp server:/tmp/unifilar-caso_A_mezquita.svg /tmp/");
