/**
 * Seed inicial de ProposalDefaults (singleton del generador de propuestas v2).
 *
 * Cómo correrlo (manual, una sola vez, cuando se autorice):
 *   docker compose exec server npx tsx prisma/scripts/seed-proposal-defaults.ts
 *   # o, desde el host con DATABASE_URL apuntando a la DB:
 *   npx tsx server/prisma/scripts/seed-proposal-defaults.ts
 *
 * Idempotente: si el singleton no existe, lo crea con todos los defaults. Si
 * ya existe, SOLO agrega las claves que falten (preservando los `value` y
 * flags `asesorCanOverride` que ya se hayan modificado desde Admin). No pisa
 * nada existente.
 *
 * Valores numéricos: extraídos del Excel "Negocio Paneles v8 Jose Gonzalez"
 * (paneles/estructura/eléctrica/meter/costos fijos/variables/BBVA) + valores
 * razonables a ajustar desde Admin (matriz de inversores, mano de obra,
 * comisiones, derivados). Ver docs/features/proposals-v2/SPEC.md.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Flagged = { value: number | string; asesorCanOverride: boolean };

// Estructura del JSON `data`. Cada variable es { value, asesorCanOverride }.
const DEFAULT_DATA: Record<string, Flagged | Record<string, Flagged>> = {
  // ── Precios equipamiento (USD sin IVA) ──
  precioPanelUsdSinIva: { value: 100, asesorCanOverride: false }, // Excel Costos B3 (100; ver pendiente 100 vs 105)
  precioEstructuraUsdSinIva: { value: 90, asesorCanOverride: false }, // B4
  precioElectricaMonoUsdSinIva: { value: 492, asesorCanOverride: false }, // B5 mono
  precioElectricaTriUsdSinIva: { value: 750, asesorCanOverride: false }, // B5 trifásico

  // ── Inversor por red + potencia ──
  precioInversorMonoSub7Usd: { value: 1000, asesorCanOverride: false },
  precioInversorMonoSup7Usd: { value: 1300, asesorCanOverride: false }, // valor real Excel B6
  precioInversorTriSub11Usd: { value: 1750, asesorCanOverride: false },
  precioInversorTri12Usd: { value: 2000, asesorCanOverride: false },
  precioInversorTri21Usd: { value: 2200, asesorCanOverride: false },
  precioInversorTri31Usd: { value: 2800, asesorCanOverride: false },
  precioInversorTri51Usd: { value: 5000, asesorCanOverride: false },
  precioInversorTriMas: { value: 8000, asesorCanOverride: false },

  // ── Meter ──
  precioMeterMonoUsd: { value: 110, asesorCanOverride: false }, // B7 mono
  precioMeterTriUsd: { value: 220, asesorCanOverride: false }, // B7 trifásico

  // ── Marcas (editables por asesor) ──
  marcaPanelesDefault: { value: "Resun", asesorCanOverride: true },
  marcaInversorDefault: { value: "Growatt", asesorCanOverride: true },

  // ── Costos fijos del negocio (pesos) ──
  costoFijoTotalPesosMes: { value: 300833.68, asesorCanOverride: false }, // Excel Costos I20
  negociosPromedioMes: { value: 4, asesorCanOverride: false },

  // ── Costos variables (pesos) ──
  costoFletePorKm: { value: 60, asesorCanOverride: false }, // 2100 a 35 km
  costoNaftaTotalPesos: { value: 700, asesorCanOverride: false }, // M5
  costoAlojamientoPesos: { value: 3500, asesorCanOverride: false }, // M6
  costoViaticosPesos: { value: 3000, asesorCanOverride: false }, // M7
  costoOtrosPesos: { value: 2000, asesorCanOverride: false }, // M4

  // ── Mano de obra (modelo Excel: (elec+capataz+catD) × horas × cuadrilla / dólar) ──
  // Tarifas horarias en PESOS por rol (Excel CALCULADORA W2/W3/W4).
  tarifaCatAPorHora: { value: 814, asesorCanOverride: false }, // Electricista ($/h) — W2
  tarifaCatCPorHora: { value: 947, asesorCanOverride: false }, // Capataz ($/h) — W3
  tarifaCatDPorHora: { value: 543, asesorCanOverride: false }, // CAT D ($/h) — W4
  horasManoDeObraPorInstalacion: { value: 10, asesorCanOverride: false }, // Excel J4 "×10"

  // ── Comisiones ──
  comisionVendedorPorcentaje: { value: 0.04, asesorCanOverride: false },
  comisionBbvaPorcentaje: { value: 0.04, asesorCanOverride: false },

  // ── Defaults de cotización ──
  cotizacionDolarDefault: { value: 40, asesorCanOverride: true }, // Excel C12
  markupPorcentajeDefault: { value: 0.15, asesorCanOverride: false }, // C13
  distanciaInstalacionKmDefault: { value: 0, asesorCanOverride: true },

  // ── Financiación BBVA (modelo Excel "Financiacion BBVA" con UI + PMT) ──
  // Tasa anual nominal del PMT por plazo (Excel B1/D1/F1).
  bbva24mInteresUI: { value: 0, asesorCanOverride: false }, // B1
  bbva36mInteresUI: { value: 0, asesorCanOverride: false }, // D1
  bbva60mInteresUI: { value: 0.05, asesorCanOverride: false }, // F1
  // Cotización de la Unidad Indexada (Excel B4).
  cotizacionUI: { value: 6.33, asesorCanOverride: false },
  // Gastos admin sobre el capital, por plazo (Excel B6/D6/F6).
  bbva24mGastosAdminCapital: { value: 0.025, asesorCanOverride: false },
  bbva36mGastosAdminCapital: { value: 0.045, asesorCanOverride: false },
  bbva60mGastosAdminCapital: { value: 0.015, asesorCanOverride: false },
  // Factor sobre la cuota PMT, por plazo (Excel ×1.023 / ×1.036 / ×1.071).
  bbva24mFactorCuota: { value: 1.023, asesorCanOverride: false },
  bbva36mFactorCuota: { value: 1.036, asesorCanOverride: false },
  bbva60mFactorCuota: { value: 1.071, asesorCanOverride: false },

  // ── Plazos de entrega (días + textos) ──
  plazos: {
    diasPagoInicial: { value: 0, asesorCanOverride: false },
    diasCoordinacion: { value: 21, asesorCanOverride: false }, // 3 semanas
    diasInstalacion: { value: 3, asesorCanOverride: false },
    diasHabilitacion: { value: 56, asesorCanOverride: false }, // 8 semanas
    textoFirma: { value: "Firma de contrato y 50% de pago inicial", asesorCanOverride: false },
    textoCoordinacion: { value: "Coordinación previa: agenda, gestiones y acopio", asesorCanOverride: false },
    textoInstalacion: { value: "Instalación física: montaje sobre el techo", asesorCanOverride: false },
    textoHabilitacion: { value: "Habilitación UTE y puesta en marcha", asesorCanOverride: false },
  },

  // ── Otros ──
  precioSeguroGranizoUsdPorPanelAno: { value: 12, asesorCanOverride: false },
};

// Coordenadas del overlay de la tapa (placeholder hasta cargar la tapa real).
const DEFAULT_COVER_OVERLAY = {
  clientName: { x: 100, y: 900, fontSize: 32, color: "#FFFFFF", fontWeight: "bold" },
  city: { x: 100, y: 850, fontSize: 18, color: "#FFFFFF", fontWeight: "regular" },
  date: { x: 100, y: 800, fontSize: 18, color: "#FFFFFF", fontWeight: "regular" },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Agrega a `target` solo las claves de `source` que falten (recursivo). No
 * pisa valores existentes — preserva lo modificado desde Admin. Devuelve la
 * cantidad de claves agregadas.
 */
function fillMissing(target: Record<string, unknown>, source: Record<string, unknown>): number {
  let added = 0;
  for (const [key, srcVal] of Object.entries(source)) {
    if (!(key in target)) {
      target[key] = srcVal;
      added += 1;
    } else if (isPlainObject(srcVal) && isPlainObject(target[key]) && !("value" in srcVal)) {
      // Subobjeto (ej. `plazos`): recurro para agregar subclaves faltantes.
      added += fillMissing(target[key] as Record<string, unknown>, srcVal);
    }
  }
  return added;
}

async function main() {
  const existing = await prisma.proposalDefaults.findUnique({ where: { id: "singleton" } });

  if (!existing) {
    await prisma.proposalDefaults.create({
      data: {
        id: "singleton",
        data: DEFAULT_DATA as unknown as Prisma.InputJsonValue,
        coverOverlay: DEFAULT_COVER_OVERLAY as unknown as Prisma.InputJsonValue,
        coverPdfAttachmentId: null,
      },
    });
    console.log("✅ ProposalDefaults singleton creado con todos los defaults.");
    return;
  }

  // Ya existe: solo agrego claves faltantes, preservando lo existente.
  const merged = isPlainObject(existing.data) ? { ...(existing.data as Record<string, unknown>) } : {};
  const added = fillMissing(merged, DEFAULT_DATA as unknown as Record<string, unknown>);
  const overlay = isPlainObject(existing.coverOverlay)
    ? existing.coverOverlay
    : DEFAULT_COVER_OVERLAY;

  if (added === 0) {
    console.log("ℹ️  El singleton ya tiene todas las claves. No se cambió nada.");
    return;
  }

  await prisma.proposalDefaults.update({
    where: { id: "singleton" },
    data: {
      data: merged as unknown as Prisma.InputJsonValue,
      coverOverlay: overlay as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`✅ Singleton actualizado: ${added} clave(s) nueva(s) agregada(s), el resto preservado.`);
}

main()
  .catch((err) => {
    console.error("❌ Error en seed-proposal-defaults:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
