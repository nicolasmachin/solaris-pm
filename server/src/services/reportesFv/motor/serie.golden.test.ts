// Verificación del port del motor de cálculo, en dos niveles.
//
//   1. EQUIVALENCIA con el motor Python (`verificacion-port.json`)
//      Se corrió `generar_historico.py` del sistema original con los datos de
//      hoy y se comparó su salida contra la del motor TypeScript con los mismos
//      inputs. Este test exige coincidencia EXACTA, sin excepciones. Es la
//      prueba de que el port no cambió el cálculo.
//
//   2. GOLDEN contra el histórico realmente emitido (`golden-historico.json`)
//      Las 282 filas de `historico_clientes.xlsx`, o sea los números que los
//      clientes efectivamente vieron en sus reportes. Coincide todo salvo un
//      conjunto acotado de filas documentadas abajo, que no son reproducibles
//      con los datos actuales porque el histórico se fue armando con una corrida
//      por mes y la planilla cambió entre corridas.
//
// Correr: npm run test:reportes-fv-golden
//
// Si el test 1 falla después de tocar metrics.ts o serie.ts, el cálculo cambió.
// La pregunta no es "cómo lo hago pasar" sino "qué pasa con los reportes ya
// enviados".

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { calcularSerie, type ConfigSerie, type LecturaSerie, type ResultadoPeriodo } from "./serie.js";
import type { TarifaKey, TarifaSnapshot } from "./types.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const TOLERANCIA = 0.01;

interface FixtureCliente {
  nombre: string;
  config: {
    potenciaContratadaKw: number | null;
    pctPunta: number | null;
    pctLlano: number | null;
    pctValle: number | null;
    inversionUsd: number;
    potenciaInstaladaKwp: number;
    mesInicio: string | null;
    tipoCliente: string;
    tarifaContratada: string | null;
  };
  lecturas: LecturaSerie[];
  esperado: Array<Record<string, number | string | null>>;
}

interface Fixture {
  tipoCambioUsd: number;
  tarifas: TarifaSnapshot;
  clientes: FixtureCliente[];
}

function cargar(nombre: string): Fixture {
  return JSON.parse(readFileSync(join(AQUI, "__fixtures__", nombre), "utf8"));
}

// Campos comparados. Excluido a propósito:
//   irpf — el original hacía `data.get("irpf")` pero main.py nunca lo pasaba, así
//          que la columna quedó en NaN en casi todas las filas. El port sí lo
//          calcula (y lo persiste); no hay contra qué compararlo.
const CAMPOS: Array<[enFixture: string, enResultado: string]> = [
  ["autoconsumoKwh", "autoconsumoKwh"],
  ["importacionRedKwh", "importacionRedKwh"],
  ["ahorroAutoconsumo", "ahorroAutoconsumo"],
  ["ahorroVenta", "ahorroVenta"],
  ["ahorroTotal", "ahorroTotal"],
  ["ahorroTotalUsd", "ahorroTotalUsd"],
  ["saldoAplicado", "saldoAplicado"],
  ["saldoGeneradoMes", "saldoGeneradoMes"],
  ["saldoInicial", "saldoInicialNormalizado"],
  ["saldoFinal", "saldoFinalNormalizado"],
];

/**
 * Filas del histórico emitido que NO se pueden reproducir con los datos de hoy.
 *
 * Causa verificada: el histórico no es un snapshot coherente. Se armó con una
 * corrida por mes y cada fila quedó calculada con el estado que tenía la hoja
 * `datos` en SU momento. Cuando después se cargó o corrigió un valor, la fila
 * vieja no se regeneró. Se comprobó corriendo el motor Python original con los
 * datos actuales: produce exactamente los mismos números que el port (test de
 * equivalencia), no los del histórico archivado.
 *
 * Clave: "cliente|periodo|campo" para los casos sueltos.
 */
const EXCEPCIONES = new Set<string>([
  // El crédito por exportación se valúa con lo exportado el mes anterior. Estas
  // filas se emitieron cuando el mes anterior aún no estaba cargado en `datos`.
  "Luis Henderson|2026-01|ahorroVenta",
  "Luis Henderson|2026-01|ahorroTotal",
  "Luis Henderson|2026-01|ahorroTotalUsd",
  "Gabriel Irigaray|2026-03|ahorroVenta",
  "Gabriel Irigaray|2026-03|ahorroTotal",
  "Gabriel Irigaray|2026-03|ahorroTotalUsd",
  "Gabriel Irigaray|2026-03|saldoGeneradoMes",
  "Susana Guerrico|2026-01|ahorroVenta", // $0,44 de diferencia
  "Susana Guerrico|2026-01|ahorroTotal",
]);

/**
 * Clientes cuyo arrastre de saldo de cuenta corriente diverge del histórico a
 * partir de cierto mes, por la misma causa. Una vez que el saldo se desvía, todo
 * el resto de la serie arrastra la diferencia, así que se listan por cliente y
 * periodo-desde en vez de fila por fila.
 *
 * Los campos de energía y ahorro de estos mismos clientes SÍ coinciden: la
 * divergencia es sólo del saldo acumulado.
 */
const DESVIO_SALDO_DESDE: Record<string, string> = {
  "Antonio Costa Vital": "2026-03", // fila corrupta en el origen (todo NaN salvo generación)
  "Bettina Posada": "2026-06",
  "Gabriel Irigaray": "2026-03",
  "Gabriel Mai": "2026-04",
  "Jorge Tello": "2026-03",
  Raij: "2026-05",
  "Rodrigo Alvarez": "2026-04",
  "Rubén Penedo": "2026-04",
};

const CAMPOS_SALDO = new Set(["saldoInicial", "saldoAplicado", "saldoGeneradoMes", "saldoFinal"]);

interface Diferencia {
  cliente: string;
  periodo: string;
  campo: string;
  esperado: number;
  obtenido: number;
}

/**
 * Replica `_normalizar_saldos_historicos` de `src/storage.py`.
 *
 * Las columnas `saldo_inicial_mes` y `saldo` del histórico NO son las que
 * produjo el cálculo: al guardar, storage.py las recomputaba desde cero
 * acumulando sólo `saldo_aplicado` y `saldo_generado` de las filas del archivo
 * —que excluyen los meses sin datos—, mientras que el cálculo real arrastra el
 * saldo por TODOS los meses. Para comparar hay que aplicar la misma
 * normalización a la salida del motor.
 */
function normalizarSaldos(
  filas: Array<{ periodo: string; saldoAplicado: number; saldoGeneradoMes: number }>,
): Map<string, { saldoInicialNormalizado: number; saldoFinalNormalizado: number }> {
  const out = new Map<string, { saldoInicialNormalizado: number; saldoFinalNormalizado: number }>();
  const r2 = (v: number) => Math.round(v * 100) / 100;
  let corriente = 0;
  for (const fila of filas) {
    const saldoInicialNormalizado = r2(corriente);
    const aplicado = Number.isFinite(fila.saldoAplicado) ? fila.saldoAplicado : 0;
    const generado = Number.isFinite(fila.saldoGeneradoMes) ? fila.saldoGeneradoMes : 0;
    corriente = r2(Math.max(corriente - aplicado + generado, 0));
    out.set(fila.periodo, { saldoInicialNormalizado, saldoFinalNormalizado: corriente });
  }
  return out;
}

function serieDe(cliente: FixtureCliente, fixture: Fixture): ResultadoPeriodo[] {
  const c = cliente.config;
  assert.ok(
    c.potenciaContratadaKw != null && c.pctPunta != null && c.pctLlano != null && c.pctValle != null,
    `${cliente.nombre}: config incompleta en el fixture`,
  );
  const config: ConfigSerie = {
    potenciaContratadaKw: c.potenciaContratadaKw,
    pctPunta: c.pctPunta,
    pctLlano: c.pctLlano,
    pctValle: c.pctValle,
    inversionUsd: c.inversionUsd,
    potenciaInstaladaKwp: c.potenciaInstaladaKwp,
    mesInicio: c.mesInicio,
    tipoCliente: c.tipoCliente === "empresa" ? "empresa" : "residencial",
    tarifaContratada: (c.tarifaContratada as TarifaKey | null) ?? null,
  };
  return calcularSerie({
    config,
    lecturas: cliente.lecturas,
    tarifaPorPeriodo: () => fixture.tarifas,
    tipoCambioPorPeriodo: () => fixture.tipoCambioUsd,
  });
}

function comparar(fixture: Fixture, aplicarExcepciones: boolean) {
  const diferencias: Diferencia[] = [];
  let filasComparadas = 0;

  for (const cliente of fixture.clientes) {
    const serie = serieDe(cliente, fixture);
    const porPeriodo = new Map(serie.map((r) => [r.periodo, r]));
    // La normalización corre sobre los meses reportables, igual que storage.py.
    const saldosNorm = normalizarSaldos(serie.filter((r) => !r.omitido));
    const desvioDesde = aplicarExcepciones ? DESVIO_SALDO_DESDE[cliente.nombre] : undefined;

    for (const fila of cliente.esperado) {
      const periodo = String(fila.periodo);
      const obtenido = porPeriodo.get(periodo);
      assert.ok(obtenido, `${cliente.nombre} ${periodo}: el motor no produjo este periodo`);

      const valores: Record<string, number> = {
        ...(obtenido as unknown as Record<string, number>),
        ...(saldosNorm.get(periodo) ?? { saldoInicialNormalizado: 0, saldoFinalNormalizado: 0 }),
      };

      filasComparadas++;
      for (const [enFixture, enResultado] of CAMPOS) {
        const esperado = fila[enFixture] as number | null;
        if (esperado == null) continue; // NaN en el origen: nada que comparar
        if (aplicarExcepciones && EXCEPCIONES.has(`${cliente.nombre}|${periodo}|${enFixture}`)) continue;
        if (desvioDesde && periodo >= desvioDesde && CAMPOS_SALDO.has(enFixture)) continue;

        const valor = valores[enResultado];
        if (!(Math.abs(valor - esperado) <= TOLERANCIA)) {
          diferencias.push({ cliente: cliente.nombre, periodo, campo: enResultado, esperado, obtenido: valor });
        }
      }
    }
  }

  return { diferencias, filasComparadas };
}

function reportar(diferencias: Diferencia[], filasComparadas: number) {
  if (diferencias.length === 0) return;
  // Se imprime la tabla antes de fallar: una diferencia suelta no dice nada, el
  // patrón sí (¿un cliente? ¿un campo? ¿desde un mes?).
  const porCampo = new Map<string, number>();
  for (const d of diferencias) porCampo.set(d.campo, (porCampo.get(d.campo) ?? 0) + 1);

  console.error(`\n${diferencias.length} diferencias sobre ${filasComparadas} filas\n`);
  console.error("Por campo:");
  for (const [campo, n] of [...porCampo].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${campo.padEnd(26)} ${n}`);
  }
  console.error("\nPrimeras 40:");
  for (const d of diferencias.slice(0, 40)) {
    console.error(
      d.cliente.slice(0, 27).padEnd(28) +
        d.periodo.padEnd(9) +
        d.campo.padEnd(26) +
        String(d.esperado).padStart(13) +
        String(d.obtenido).padStart(13),
    );
  }
  console.error("");
}

test("equivale exactamente al motor Python con los mismos datos", () => {
  const fixture = cargar("verificacion-port.json");
  const { diferencias, filasComparadas } = comparar(fixture, false);
  reportar(diferencias, filasComparadas);

  assert.equal(diferencias.length, 0, "el port dejó de coincidir con el motor original");
  assert.ok(filasComparadas > 150, `sólo se compararon ${filasComparadas} filas`);
  console.log(`  ${filasComparadas} filas × ${CAMPOS.length} campos, sin diferencias`);
});

test("reproduce el histórico realmente emitido a los clientes", () => {
  const fixture = cargar("golden-historico.json");
  const { diferencias, filasComparadas } = comparar(fixture, true);
  reportar(diferencias, filasComparadas);

  assert.equal(diferencias.length, 0, "hay filas del histórico emitido que el motor no reproduce");
  assert.equal(filasComparadas, 282, `se compararon ${filasComparadas} filas, se esperaban 282`);
  console.log(`  ${filasComparadas} filas del histórico reproducidas`);
});
