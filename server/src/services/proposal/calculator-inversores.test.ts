// Tests de "inversores distintos" en una misma propuesta.
//   npm run test:inversores
//
// Lo que más importa proteger: que una propuesta SIN la lista (todas las ya
// emitidas) dé exactamente el mismo resultado que antes, y que con la lista
// cada inversor se cotice con su potencia y sus paneles.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { calculate } from "./calculator.js";
import {
  describirInversores,
  marcasInversores,
  panelesInversoresDescuadre,
  repartirProporcional,
  resolverPanelesInversores,
  sincronizarSistemaInversores,
} from "./inversores.js";
import { draftDataPublishSchema, draftDataStorageSchema } from "./schemas/draft.schema.js";
import { renderProposalFull } from "./template.js";
import { defaultsFixture } from "./test-fixtures.js";
import type { ProposalData, ProposalDefaultsResolved } from "./types.js";

// Escalones de la eléctrica distintos entre sí, para que se note sobre qué
// cantidad de paneles se calculó cada uno (el fixture general los tiene en 1).
const defaults: ProposalDefaultsResolved = {
  ...defaultsFixture,
  multiplicadorElectricaEscalones: [1, 2, 3, 4, 5, 6, 7],
};

const base = (suministro: "monofásico" | "trifásico"): ProposalData => ({
  cliente: { nombre: "Caso Inversores", dirigidoA: "Estimado,", ciudad: "Montevideo" },
  factura: { pagaMensualPesos: 9000, tarifa: "Simple", suministro, potenciaContratadaKw: 15 },
  techo: { descripcion: "Chapa", tamanoM2: 120 },
  cotizacion: {
    distanciaInstalacionKm: 30,
    cotizacionDolar: 40,
    markupPorcentaje: 20,
    plazoEntrega: "3 a 4 semanas",
  },
  sistema: {
    cantidadPaneles: 24,
    potenciaPanelW: 590,
    marcaPaneles: "Resun",
    potenciaInversorKw: 6,
    marcaInversor: "Growatt",
    tipoMontaje: "Chapa",
  },
  fecha: "2026-09-29",
  itemsAdicionales: [],
});

const conInversores = (
  suministro: "monofásico" | "trifásico",
  inversores: NonNullable<ProposalData["sistema"]["inversores"]>,
  cantidadPaneles = 24,
): ProposalData => {
  const b = base(suministro);
  return {
    ...b,
    sistema: sincronizarSistemaInversores({ ...b.sistema, cantidadPaneles, inversores }),
  };
};

const OCHO_Y_SEIS = [
  { marca: "Growatt", potenciaKw: 8 },
  { marca: "Huawei", potenciaKw: 6 },
];

// ── Reparto de paneles ──

test("reparto proporcional: la suma da exacto el total", () => {
  // 24 × 8/14 = 13,71 y 24 × 6/14 = 10,29 → 13 + 10 = 23; el panel que sobra va
  // al de resto más grande (0,71).
  assert.deepEqual(repartirProporcional(24, [8, 6]), [14, 10]);
  assert.deepEqual(repartirProporcional(25, [6, 6]), [13, 12]);
  assert.deepEqual(repartirProporcional(10, [5, 5, 5]), [4, 3, 3]);
  for (const total of [0, 1, 7, 13, 31, 100]) {
    const r = repartirProporcional(total, [8, 6, 3.6]);
    assert.equal(r.reduce((a, b) => a + b, 0), total, `total ${total}`);
  }
});

test("reparto sin potencias cargadas: partes iguales", () => {
  assert.deepEqual(repartirProporcional(9, [0, 0]), [5, 4]);
});

test("los paneles cargados a mano se respetan y el resto se reparte", () => {
  const r = resolverPanelesInversores(24, [
    { marca: "Growatt", potenciaKw: 8, paneles: 16 },
    { marca: "Huawei", potenciaKw: 6 },
  ]);
  assert.deepEqual(
    r.map((i) => [i.paneles, i.panelesManual]),
    [
      [16, true],
      [8, false],
    ],
  );
});

test("descuadre de paneles: solo cuando se cargan a mano", () => {
  assert.equal(panelesInversoresDescuadre(24, OCHO_Y_SEIS), 0);
  assert.equal(
    panelesInversoresDescuadre(24, [
      { marca: "A", potenciaKw: 8, paneles: 14 },
      { marca: "B", potenciaKw: 6, paneles: 12 },
    ]),
    2,
  );
  assert.equal(
    panelesInversoresDescuadre(24, [
      { marca: "A", potenciaKw: 8, paneles: 10 },
      { marca: "B", potenciaKw: 6, paneles: 10 },
    ]),
    -4,
  );
});

// ── Textos ──

test("describe los inversores agrupando los iguales", () => {
  assert.equal(describirInversores(OCHO_Y_SEIS), "1 Growatt de 8 kW + 1 Huawei de 6 kW");
  assert.equal(
    describirInversores([
      { marca: "Growatt", potenciaKw: 6 },
      { marca: "Huawei", potenciaKw: 8 },
      { marca: "Growatt", potenciaKw: 6 },
    ]),
    "2 Growatt de 6 kW + 1 Huawei de 8 kW",
  );
  assert.equal(describirInversores([{ marca: "Growatt", potenciaKw: 3.6 }, { marca: "Growatt", potenciaKw: 5 }]), "1 Growatt de 3,6 kW + 1 Growatt de 5 kW");
  assert.equal(marcasInversores([{ marca: "Growatt", potenciaKw: 8 }, { marca: "growatt", potenciaKw: 6 }]), "Growatt");
});

test("sincroniza cantidad, potencia (suma) y marca desde la lista", () => {
  const s = sincronizarSistemaInversores({ ...base("monofásico").sistema, inversores: OCHO_Y_SEIS });
  assert.equal(s.cantidadInversores, 2);
  assert.equal(s.potenciaInversorKw, 14);
  assert.equal(s.marcaInversor, "Growatt + Huawei");
  // Con uno solo, no toca nada.
  const uno = { ...base("monofásico").sistema, inversores: [OCHO_Y_SEIS[0]] };
  assert.equal(sincronizarSistemaInversores(uno), uno);
});

// ── Compatibilidad ──

test("sin lista, o con lista de 0 o 1, el cálculo es exactamente el de siempre", () => {
  for (const sum of ["monofásico", "trifásico"] as const) {
    const b = base(sum);
    const antes = calculate(b, defaults);
    assert.equal("inversoresDetalle" in antes, false);
    assert.deepEqual(calculate({ ...b, sistema: { ...b.sistema, inversores: [] } }, defaults), antes);
    assert.deepEqual(
      calculate({ ...b, sistema: { ...b.sistema, inversores: [{ marca: "Huawei", potenciaKw: 30 }] } }, defaults),
      antes,
    );
    // Y con varios inversores iguales, también.
    const dos = { ...b, sistema: { ...b.sistema, cantidadInversores: 2 } };
    assert.deepEqual(calculate({ ...dos, sistema: { ...dos.sistema, inversores: [] } }, defaults), calculate(dos, defaults));
  }
});

// ── Cálculo con inversores distintos ──

test("8 + 6 kW monofásico: cada inversor con su precio y su eléctrica", () => {
  const r = calculate(conInversores("monofásico", OCHO_Y_SEIS), defaults);
  const d = r.inversoresDetalle!;
  assert.equal(d.length, 2);
  // Paneles: 14 y 10 (reparto por potencia).
  assert.deepEqual(d.map((i) => i.paneles), [14, 10]);
  // Inversor: 8 kW ≥ 7 → Sup7; 6 kW < 7 → Sub7.
  assert.equal(d[0].precioInversorUsdSinIva, defaults.precioInversorMonoSup7Usd);
  assert.equal(d[1].precioInversorUsdSinIva, defaults.precioInversorMonoSub7Usd);
  // Eléctrica: 14 paneles → escalón ≤20 (×2); 10 paneles → ≤10 (×1).
  assert.equal(d[0].precioElectricaUsdSinIva, defaults.precioElectricaMonoUsdSinIva * 2);
  assert.equal(d[1].precioElectricaUsdSinIva, defaults.precioElectricaMonoUsdSinIva * 1);

  assert.equal(r.inversorCantidad, 2);
  assert.equal(r.electricaCantidad, 2);
  // La línea del costeo = suma de los dos (el costo/unidad es el promedio).
  assert.equal(r.inversorPrecioUnitario * r.inversorCantidad, 1300 + 1000);
  assert.equal(r.electricaPrecioUnitario * r.electricaCantidad, 492 * 3);

  // El resto del equipamiento sigue el total del sistema.
  assert.equal(r.panelCantidad, 24);
  assert.equal(r.meterCantidad, 1);
  const esperado =
    defaults.precioPanelUsdSinIva * 24 +
    defaults.precioEstructuraUsdSinIva * 24 +
    492 * 3 +
    2300 +
    defaults.precioMeterMonoUsd;
  assert.ok(Math.abs(r.costoEquipamientoSinIva - esperado) < 1e-9);
});

test("8 + 6 kW trifásico", () => {
  const r = calculate(conInversores("trifásico", OCHO_Y_SEIS), defaults);
  const d = r.inversoresDetalle!;
  // Los dos por debajo de 11 kW.
  assert.equal(d[0].precioInversorUsdSinIva, defaults.precioInversorTriSub11Usd);
  assert.equal(d[1].precioInversorUsdSinIva, defaults.precioInversorTriSub11Usd);
  assert.equal(r.inversorPrecioUnitario * r.inversorCantidad, 1750 * 2);
  assert.equal(r.electricaPrecioUnitario * r.electricaCantidad, 750 * 2 + 750 * 1);
});

test("trifásico: el caso de pocos paneles se evalúa con los paneles de ESE inversor", () => {
  // 12 kW con 10 paneles a mano → caso especial Tri12; 15 kW con los 20
  // restantes → Tri21.
  const r = calculate(
    conInversores(
      "trifásico",
      [
        { marca: "Huawei", potenciaKw: 12, paneles: 10 },
        { marca: "Growatt", potenciaKw: 15 },
      ],
      30,
    ),
    defaults,
  );
  const d = r.inversoresDetalle!;
  assert.deepEqual(d.map((i) => i.paneles), [10, 20]);
  assert.equal(d[0].precioInversorUsdSinIva, defaults.precioInversorTri12Usd);
  assert.equal(d[1].precioInversorUsdSinIva, defaults.precioInversorTri21Usd);
});

test("la potencia pico y el ahorro no dependen de los inversores", () => {
  const clasico = calculate(base("monofásico"), defaults);
  const distintos = calculate(conInversores("monofásico", OCHO_Y_SEIS), defaults);
  assert.equal(distintos.potenciaTotalKwp, clasico.potenciaTotalKwp);
  assert.equal(distintos.ahorroMensualPesos, clasico.ahorroMensualPesos);
  assert.equal(distintos.manoDeObraUsdSinIva, clasico.manoDeObraUsdSinIva);
});

test("un ajuste manual del costeo pisa la línea entera, también con inversores distintos", () => {
  const r = calculate(
    { ...conInversores("monofásico", OCHO_Y_SEIS), costos: { inversorPrecioUnitario: 900 } },
    defaults,
  );
  assert.equal(r.inversorPrecioUnitario, 900);
  assert.equal(r.inversorCantidad, 2);
  // El detalle sigue mostrando los precios de fábrica de cada uno.
  assert.equal(r.inversoresDetalle![0].precioInversorUsdSinIva, 1300);
});

// ── Schema ──

test("publicar exige marca y potencia de cada inversor, y que los paneles cuadren", () => {
  const ok = conInversores("monofásico", OCHO_Y_SEIS);
  assert.equal(draftDataPublishSchema.safeParse(ok).success, true);

  const sinMarca = conInversores("monofásico", [{ marca: "", potenciaKw: 8 }, OCHO_Y_SEIS[1]]);
  const r1 = draftDataPublishSchema.safeParse(sinMarca);
  assert.equal(r1.success, false);

  const descuadre = conInversores("monofásico", [
    { marca: "Growatt", potenciaKw: 8, paneles: 20 },
    { marca: "Huawei", potenciaKw: 6, paneles: 10 },
  ]);
  const r2 = draftDataPublishSchema.safeParse(descuadre);
  assert.equal(r2.success, false);
  assert.ok(!r2.success && r2.error.issues.some((i) => i.path.join(".") === "sistema.inversores"));
});

test("el autosave acepta inversores a medio cargar", () => {
  const r = draftDataStorageSchema.safeParse({
    sistema: { inversores: [{ marca: "Growatt" }, { potenciaKw: 0 }] },
  });
  assert.equal(r.success, true);
});

// ── Documento ──

test("el documento describe los inversores distintos", () => {
  const data = conInversores("monofásico", [
    { marca: "Growatt", potenciaKw: 6 },
    { marca: "Huawei", potenciaKw: 8 },
    { marca: "Growatt", potenciaKw: 6 },
  ], 30);
  const html = renderProposalFull({
    data,
    calculated: calculate(data, defaults),
    advisor: { name: "Asesor", jobTitle: "Asesor comercial", email: "a@b.c" },
  });
  assert.ok(html.includes("2 Growatt de 6 kW + 1 Huawei de 8 kW"));
  assert.ok(html.includes("3 inversores"));
  assert.ok(!html.includes("unidades de"));
});

test("el documento clásico sigue igual (sin lista)", () => {
  const data = base("monofásico");
  const html = renderProposalFull({
    data,
    calculated: calculate(data, defaults),
    advisor: { name: "Asesor", jobTitle: "Asesor comercial", email: "a@b.c" },
  });
  assert.ok(html.includes("Marca:"));
  assert.ok(!html.includes(" de 6 kW + "));
});
