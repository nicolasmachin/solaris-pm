// Smoke test del extractor IA de minutas. Procesa los PDFs reales que están
// en `docs/features/preingenieria/casos_referencia/minutas/` y compara los
// campos extraídos contra "ground truth" básico (qué se espera para cada
// caso). Imprime un reporte de aciertos por caso.
//
// Correr: docker compose exec server node --import tsx scripts/smoke-minuta.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  extractFromMinuta,
  type ExtractedFields,
} from "../src/services/minutaExtraction/index.js";

// Los fixtures se copian a server/scripts/fixtures/minutas/ (gitignored). Si
// no existen, podés copiarlos desde docs/features/preingenieria/...
const REF_DIR = "/app/scripts/fixtures/minutas";

interface GroundTruth {
  // Campos críticos sobre los que medimos acierto. Para strings usamos "contains"
  // (no equality) para tolerar paráfrasis del modelo.
  tipoTecho?: string;
  redMonofasica?: boolean;
  redTrifasica230SN?: boolean;
  redTrifasica400CN?: boolean;
  cantidadPanelesContains?: string;
  inversorContains?: string;
  infoTechoContains?: string[];
  notasAdicionalesContains?: string[];
}

interface Case {
  name: string;
  filename: string;
  expected: GroundTruth;
}

const cases: Case[] = [
  {
    name: "Diego Trias",
    filename: "diego_trias.pdf",
    expected: {
      tipoTecho: "CHAPA",
      redMonofasica: true,
      redTrifasica230SN: false,
      redTrifasica400CN: false,
      cantidadPanelesContains: "10",
      infoTechoContains: ["chapa"],
    },
  },
  {
    name: "Jose Percovich",
    filename: "jose_percovich.pdf",
    expected: {
      tipoTecho: "HORMIGON",
      redMonofasica: true,
      cantidadPanelesContains: "12",
    },
  },
  {
    name: "Edgar Valdes",
    filename: "edgar_valdes.pdf",
    expected: {
      tipoTecho: "TEJAS",
      redTrifasica230SN: true,
      inversorContains: "Huawei",
    },
  },
];

function check(label: string, pass: boolean, detail?: string): boolean {
  const icon = pass ? "✅" : "❌";
  console.log(`   ${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

function evaluate(name: string, extracted: ExtractedFields, gt: GroundTruth): number {
  let total = 0;
  let passed = 0;
  console.log(`\n📋 ${name}`);

  if (gt.tipoTecho !== undefined) {
    total++;
    if (check(`tipoTecho = ${gt.tipoTecho}`, extracted.tipoTecho === gt.tipoTecho, `got: ${extracted.tipoTecho}`)) passed++;
  }
  if (gt.redMonofasica !== undefined) {
    total++;
    if (check(`redMonofasica = ${gt.redMonofasica}`, extracted.redMonofasica === gt.redMonofasica)) passed++;
  }
  if (gt.redTrifasica230SN !== undefined) {
    total++;
    if (check(`redTrifasica230SN = ${gt.redTrifasica230SN}`, extracted.redTrifasica230SN === gt.redTrifasica230SN)) passed++;
  }
  if (gt.redTrifasica400CN !== undefined) {
    total++;
    if (check(`redTrifasica400CN = ${gt.redTrifasica400CN}`, extracted.redTrifasica400CN === gt.redTrifasica400CN)) passed++;
  }
  if (gt.cantidadPanelesContains) {
    total++;
    const pass = (extracted.cantidadPaneles ?? "").toLowerCase().includes(gt.cantidadPanelesContains.toLowerCase());
    if (check(`cantidadPaneles contiene "${gt.cantidadPanelesContains}"`, pass, `got: ${extracted.cantidadPaneles}`)) passed++;
  }
  if (gt.inversorContains) {
    total++;
    const pass = (extracted.inversor ?? "").toLowerCase().includes(gt.inversorContains.toLowerCase());
    if (check(`inversor contiene "${gt.inversorContains}"`, pass, `got: ${extracted.inversor}`)) passed++;
  }
  if (gt.infoTechoContains) {
    for (const s of gt.infoTechoContains) {
      total++;
      const pass = (extracted.infoTecho ?? "").toLowerCase().includes(s.toLowerCase());
      if (check(`infoTecho contiene "${s}"`, pass)) passed++;
    }
  }
  if (gt.notasAdicionalesContains) {
    for (const s of gt.notasAdicionalesContains) {
      total++;
      const pass = (extracted.notasAdicionales ?? "").toLowerCase().includes(s.toLowerCase());
      if (check(`notasAdicionales contiene "${s}"`, pass)) passed++;
    }
  }

  return total === 0 ? 0 : (passed / total) * 100;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY no configurada");
    process.exit(1);
  }

  let totalLatency = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const accuracies: number[] = [];

  for (const c of cases) {
    const path = join(REF_DIR, c.filename);
    let buffer: Buffer;
    try {
      buffer = readFileSync(path);
    } catch (err) {
      console.error(`No pude leer ${path}:`, err);
      continue;
    }
    process.stdout.write(`Procesando ${c.name}... `);
    try {
      const result = await extractFromMinuta(buffer);
      console.log(
        `OK · ${result.metadata.latencyMs}ms · ${result.metadata.tokensInput}in / ${result.metadata.tokensOutput}out · ${result.metadata.modelUsed}`,
      );
      totalLatency += result.metadata.latencyMs;
      totalTokensIn += result.metadata.tokensInput;
      totalTokensOut += result.metadata.tokensOutput;
      const acc = evaluate(c.name, result.extractedFields, c.expected);
      accuracies.push(acc);
      console.log(`   📊 Accuracy: ${acc.toFixed(1)}%`);
      console.log(`   🔍 JSON crudo:`);
      console.log("      " + JSON.stringify(result.extractedFields, null, 2).split("\n").join("\n      "));
    } catch (err) {
      console.error(`FAIL`, err);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("RESUMEN");
  console.log("=".repeat(60));
  if (accuracies.length > 0) {
    const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    console.log(`Casos procesados: ${accuracies.length}/${cases.length}`);
    console.log(`Accuracy promedio: ${avg.toFixed(1)}%`);
    console.log(`Latencia total: ${totalLatency}ms (avg ${(totalLatency / accuracies.length).toFixed(0)}ms)`);
    console.log(`Tokens totales: ${totalTokensIn} input + ${totalTokensOut} output`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
