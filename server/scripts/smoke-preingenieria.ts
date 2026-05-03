// Smoke test del generador de Pre-Ingeniería: corre los 4 casos canónicos del
// SPEC sec. 8 y guarda los PDFs resultantes en /tmp/preingenieria-*.pdf para
// validación visual contra los 19 PDFs de referencia.
//
// Correr: docker compose exec server node --import tsx scripts/smoke-preingenieria.ts

import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  generatePreIngenieriaPdf,
  type PreIngenieriaPdfFoto,
  type PreIngenieriaPdfInputs,
} from "../src/services/preingenieriaPdf/index.js";

interface Case {
  name: string;
  inputs: PreIngenieriaPdfInputs;
  fotos: PreIngenieriaPdfFoto[];
}

const cases: Case[] = [
  {
    // Caso A: mínimo absoluto, sin fotos.
    name: "caso_A_rafael_real",
    inputs: {
      snapshotNombre: "Rafael Real",
      snapshotDireccion: "Sample 123",
      snapshotCiudad: "Montevideo",
      snapshotCelular: "099 123 456",
      snapshotFechaPrevista: "2da semana abril",
      tipoTecho: "CHAPA",
      tipoTechoOtro: null,
      infoTecho: null,
      alturaTecho: "1 piso",
      cantidadPaneles: "10",
      potenciaPaneles: "580W",
      inversor: "Growatt de 6kW",
      stringsLineasDc: "1",
      cableAc: "Superplastico 2x6mm2",
      termicaAc: "32 A",
      diferencialAc: "40 A, 300mA",
      largoCablesAcMts: "10 mts",
      largoCablesDcMts: "15 mts",
      redMonofasica: true,
      redTrifasica230SN: false,
      redTrifasica400CN: false,
      notasAdicionales: null,
    },
    fotos: [],
  },
  {
    // Caso B: residencial mono completo con notas largas.
    name: "caso_B_mussio",
    inputs: {
      snapshotNombre: "Santiago Mussio",
      snapshotDireccion: "Enrique Erro 3613 Apto 2",
      snapshotCiudad: "Solymar, Canelones",
      snapshotCelular: "091 342 531",
      snapshotFechaPrevista: "3era semana Enero 26",
      tipoTecho: "HORMIGON",
      tipoTechoOtro: null,
      infoTecho:
        "Losa liviana, pero con pretiles de hormigón para colocar perfiles de acero y escuadras de aluminio",
      alturaTecho: "2 pisos",
      cantidadPaneles: "10",
      potenciaPaneles: "550W",
      inversor: "Growatt de 6kW",
      stringsLineasDc: "1",
      cableAc: "4 mm superplastico",
      termicaAc: "32 A",
      diferencialAc: "40 A, 300mA",
      largoCablesAcMts: "30 mts",
      largoCablesDcMts: "25 mts",
      redMonofasica: true,
      redTrifasica230SN: false,
      redTrifasica400CN: false,
      notasAdicionales: "Relevar tecnicamente",
    },
    fotos: [],
  },
  {
    // Caso C: multi-instalación con dos checkboxes Red marcados (COVITEJA).
    name: "caso_C_coviteja",
    inputs: {
      snapshotNombre: "COVITEJA 25",
      snapshotDireccion: "ANAGUALPO 620",
      snapshotCiudad: "Montevideo",
      snapshotCelular: "097992701",
      snapshotFechaPrevista: "4ta semana abril",
      tipoTecho: "HORMIGON",
      tipoTechoOtro: null,
      infoTecho:
        "Techo de hormigón, estructura sobre losas de hormigón. Van 8 paneles al inversor monofasico y 12 al trifasico.",
      alturaTecho: "5 pisos",
      cantidadPaneles: "20 (8 mono, 12 tri)",
      potenciaPaneles: "590W",
      inversor: "Growatt de 6k mono, 10k tri",
      stringsLineasDc: "1 mono, 2 tri",
      cableAc: "Superplastico 2x4 y 3x4",
      termicaAc: "25 A (mono y tri)",
      diferencialAc: "40 A, 300mA (m y t)",
      largoCablesAcMts: "40 mts",
      largoCablesDcMts: "30 mts",
      redMonofasica: true,
      redTrifasica230SN: false,
      redTrifasica400CN: true,
      notasAdicionales: null,
    },
    fotos: [],
  },
  {
    // Caso D: industrial trifásico con notas multi-línea.
    name: "caso_D_industrial",
    inputs: {
      snapshotNombre: "ESTILO Industrial",
      snapshotDireccion: "Ruta 5 km 25",
      snapshotCiudad: "Las Piedras, Canelones",
      snapshotCelular: "091 000 111",
      snapshotFechaPrevista: "Mayo 2026",
      tipoTecho: "CHAPA",
      tipoTechoOtro: null,
      infoTecho: null,
      alturaTecho: "1 piso",
      cantidadPaneles: "30",
      potenciaPaneles: "580W",
      inversor: "Huawei de 25kW",
      stringsLineasDc: "3",
      cableAc: "Superplastico 4x10mm2",
      termicaAc: "40 A trifasica 4 Polos",
      diferencialAc: "40 A, 300mA 4P",
      largoCablesAcMts: "40 mts",
      largoCablesDcMts: "40 mts",
      redMonofasica: false,
      redTrifasica230SN: false,
      redTrifasica400CN: true,
      notasAdicionales:
        "Obra civil compartida con cliente:\n- Nicho para inversor.\n- Canalizaciones de bajada.\n- Zanjas y cámaras de registro.\nTecho de chapa sobre perfiles C de acero. Sellador butílico Würth.",
    },
    fotos: [],
  },
];

async function main() {
  for (const c of cases) {
    process.stdout.write(`Generando ${c.name}... `);
    try {
      const pdf = await generatePreIngenieriaPdf(c.inputs, c.fotos);
      const out = join("/tmp", `preingenieria-${c.name}.pdf`);
      writeFileSync(out, pdf);
      const exists = existsSync(out);
      const sizeKb = exists ? Math.round(pdf.length / 1024) : 0;
      console.log(`${sizeKb} KB → ${out}`);
    } catch (err) {
      console.error("ERROR", err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
