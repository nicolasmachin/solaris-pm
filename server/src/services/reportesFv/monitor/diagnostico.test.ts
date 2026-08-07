// Tests del diagnóstico diario de plantas (sin API, sin DB).
// Correr: npm run test:fv-monitor

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  contarDiasSinGeneracion,
  diagnosticar,
  fallaActiva,
  hayComunicacion,
  leerUmbrales,
  ultimoDiaConGeneracion,
  UMBRALES_DEFAULT,
  type EntradaDiagnostico,
  type EstadoDispositivo,
} from "./diagnostico.js";
import { resolverHabilitadoEn, resolverOperativaDesde } from "./habilitacion.js";
import { diaAEvaluar, diasEntre, rangoDias, sumarDias } from "./dias.js";

const DIA = "2026-08-06";
const AHORA = new Date("2026-08-07T12:30:00.000Z"); // 09:30 en Uruguay

/** Serie con un valor por día terminando en DIA. El último elemento es DIA. */
function serie(valores: number[]): Map<string, number> {
  const dias = rangoDias(sumarDias(DIA, -(valores.length - 1)), DIA);
  return new Map(dias.map((d, i) => [d, valores[i]]));
}

function inversor(over: Partial<EstadoDispositivo> = {}): EstadoDispositivo {
  return {
    deviceSn: "PBKBD9604G",
    tipo: 7,
    lost: false,
    ultimoDatoEn: new Date("2026-08-07T12:16:00.000Z"),
    statusRaw: 1,
    faultCode: 0,
    warnCode: 0,
    faultTexto: null,
    ...over,
  };
}

function entrada(over: Partial<EntradaDiagnostico> = {}): EntradaDiagnostico {
  return {
    dia: DIA,
    generacionKwh: 12,
    historial: serie([10, 11, 9, 12, 8, 10, 12]),
    habilitadoEn: new Date("2025-01-15T00:00:00.000Z"),
    dispositivos: [inversor()],
    silenciadaHasta: null,
    diasSeguidosSinDatosApi: 0,
    umbrales: UMBRALES_DEFAULT,
    ahora: AHORA,
    ...over,
  };
}

// ─── Helpers de fecha ───────────────────────────────────────────────────────

test("diaAEvaluar devuelve siempre el día anterior en hora de Uruguay", () => {
  // 09:30 del 7 en Uruguay → evalúa el 6.
  assert.equal(diaAEvaluar(new Date("2026-08-07T12:30:00.000Z")), "2026-08-06");
  // 00:30 del 7 en Uruguay (03:30 UTC) → sigue evaluando el 6.
  assert.equal(diaAEvaluar(new Date("2026-08-07T03:30:00.000Z")), "2026-08-06");
  // 22:00 del 6 en Uruguay (01:00 UTC del 7) → evalúa el 5, no el 6.
  assert.equal(diaAEvaluar(new Date("2026-08-07T01:00:00.000Z")), "2026-08-05");
});

test("diasEntre cuenta cruzando fin de mes", () => {
  assert.equal(diasEntre("2026-07-30", "2026-08-02"), 3);
  assert.equal(diasEntre("2026-08-06", "2026-08-06"), 0);
  assert.equal(diasEntre("2026-08-07", "2026-08-06"), -1);
});

// ─── Helpers del diagnóstico ────────────────────────────────────────────────

test("contarDiasSinGeneracion cuenta la racha que termina en el día evaluado", () => {
  assert.equal(contarDiasSinGeneracion(serie([10, 10, 0, 0, 0]), DIA, 0.5), 3);
  assert.equal(contarDiasSinGeneracion(serie([10, 10, 10]), DIA, 0.5), 0);
  // 0,3 kWh está por debajo del umbral: cuenta como que no generó.
  assert.equal(contarDiasSinGeneracion(serie([10, 0.3]), DIA, 0.5), 1);
});

test("contarDiasSinGeneracion corta en el primer día sin dato", () => {
  const h = new Map([
    ["2026-08-06", 0],
    ["2026-08-05", 0],
    // falta el 04 → no se sabe, la racha conocida es de 2
    ["2026-08-03", 0],
  ]);
  assert.equal(contarDiasSinGeneracion(h, DIA, 0.5), 2);
});

test("ultimoDiaConGeneracion encuentra el último día bueno", () => {
  assert.equal(ultimoDiaConGeneracion(serie([10, 12, 0, 0]), DIA, 0.5), "2026-08-04");
  assert.equal(ultimoDiaConGeneracion(serie([0, 0]), DIA, 0.5), null);
});

test("hayComunicacion mira la antigüedad del dato, no el booleano lost", () => {
  // Reportó hace 14 h: es un datalogger sano de noche.
  const reciente = inversor({ ultimoDatoEn: new Date("2026-08-06T22:30:00.000Z"), lost: true });
  assert.equal(hayComunicacion([reciente], AHORA, 36), true);

  // Reportó hace 3 días.
  const viejo = inversor({ ultimoDatoEn: new Date("2026-08-04T12:00:00.000Z") });
  assert.equal(hayComunicacion([viejo], AHORA, 36), false);

  // Sin fecha, el booleano es lo único que hay.
  assert.equal(hayComunicacion([inversor({ ultimoDatoEn: null, lost: false })], AHORA, 36), true);
  assert.equal(hayComunicacion([inversor({ ultimoDatoEn: null, lost: true })], AHORA, 36), false);
  assert.equal(hayComunicacion([], AHORA, 36), false);
});

test("fallaActiva ignora el medidor y prioriza la falla sobre la advertencia", () => {
  const medidorRoto: EstadoDispositivo = { ...inversor(), tipo: 3, deviceSn: "meter", faultCode: 5 };
  assert.equal(fallaActiva([medidorRoto]), null);

  const conAdvertencia = inversor({ warnCode: 32, deviceSn: "A" });
  const conFalla = inversor({ faultCode: 117, faultTexto: "Insulation fault", deviceSn: "B" });
  const r = fallaActiva([conAdvertencia, conFalla]);
  assert.equal(r?.deviceSn, "B");
  assert.equal(r?.esAdvertencia, false);
  assert.equal(r?.texto, "Insulation fault");
});

test("leerUmbrales toma los valores del entorno y descarta la basura", () => {
  const u = leerUmbrales({ FV_MONITOR_DIAS: "3", FV_MONITOR_KWH_MIN: "1.5" } as NodeJS.ProcessEnv);
  assert.equal(u.diasSinGeneracion, 3);
  assert.equal(u.generacionMinimaKwh, 1.5);

  const malo = leerUmbrales({ FV_MONITOR_DIAS: "cero", FV_MONITOR_KWH_MIN: "-1" } as NodeJS.ProcessEnv);
  assert.equal(malo.diasSinGeneracion, UMBRALES_DEFAULT.diasSinGeneracion);
  assert.equal(malo.generacionMinimaKwh, UMBRALES_DEFAULT.generacionMinimaKwh);
});

// ─── Árbol de decisión ──────────────────────────────────────────────────────

test("planta generando → OK sin alerta", () => {
  const r = diagnosticar(entrada());
  assert.equal(r.diagnostico, "OK");
  assert.equal(r.alerta, false);
  assert.equal(r.diasSinGeneracion, 0);
  assert.equal(r.ultimaGeneracionEn, DIA);
});

test("silenciada gana sobre todo lo demás", () => {
  const r = diagnosticar(
    entrada({
      historial: serie([0, 0, 0]),
      silenciadaHasta: new Date("2026-08-31T00:00:00.000Z"),
      dispositivos: [],
    }),
  );
  assert.equal(r.diagnostico, "SILENCIADA");
  assert.equal(r.alerta, false);
});

test("silencio vencido deja de proteger", () => {
  const r = diagnosticar(
    entrada({ historial: serie([0, 0]), silenciadaHasta: new Date("2026-08-01T00:00:00.000Z") }),
  );
  assert.equal(r.diagnostico, "SIN_GENERACION");
  assert.equal(r.alerta, true);
});

test("proyecto sin habilitar nunca alerta, aunque no genere nada", () => {
  const r = diagnosticar(entrada({ habilitadoEn: null, historial: serie([0, 0, 0, 0]) }));
  assert.equal(r.diagnostico, "ESPERANDO_HABILITACION");
  assert.equal(r.alerta, false);
});

test("habilitada ayer entra en la gracia", () => {
  const r = diagnosticar(
    entrada({
      habilitadoEn: new Date("2026-08-05T00:00:00.000Z"),
      historial: serie([0, 0]),
    }),
  );
  assert.equal(r.diagnostico, "ESPERANDO_HABILITACION");
  assert.equal(r.alerta, false);
});

test("pasada la gracia, la planta habilitada sí alerta", () => {
  const r = diagnosticar(
    entrada({
      habilitadoEn: new Date("2026-07-20T00:00:00.000Z"),
      historial: serie([0, 0]),
    }),
  );
  assert.equal(r.diagnostico, "SIN_GENERACION");
  assert.equal(r.alerta, true);
});

test("sin datos de la API no alerta la primera vez, sí a los 3 días", () => {
  const sinDatos = { generacionKwh: null, historial: new Map<string, number>() };
  const primera = diagnosticar(entrada({ ...sinDatos, diasSeguidosSinDatosApi: 0 }));
  assert.equal(primera.diagnostico, "SIN_DATOS_API");
  assert.equal(primera.alerta, false);

  const tercera = diagnosticar(entrada({ ...sinDatos, diasSeguidosSinDatosApi: 2 }));
  assert.equal(tercera.diagnostico, "SIN_DATOS_API");
  assert.equal(tercera.alerta, true);
});

test("no genera y el inversor reporta falla → ERROR_DISPOSITIVO con el texto", () => {
  const r = diagnosticar(
    entrada({
      historial: serie([10, 0, 0]),
      dispositivos: [inversor({ faultCode: 117, faultTexto: "Insulation fault" })],
    }),
  );
  assert.equal(r.diagnostico, "ERROR_DISPOSITIVO");
  assert.equal(r.alerta, true);
  assert.match(r.detalle, /Insulation fault/);
  assert.match(r.detalle, /117/);
});

test("no genera y el equipo no reporta hace días → SIN_COMUNICACION", () => {
  const r = diagnosticar(
    entrada({
      historial: serie([10, 0, 0]),
      dispositivos: [inversor({ ultimoDatoEn: new Date("2026-08-03T18:00:00.000Z") })],
    }),
  );
  assert.equal(r.diagnostico, "SIN_COMUNICACION");
  assert.equal(r.alerta, true);
  assert.match(r.detalle, /wifi/i);
});

test("no genera pero el equipo comunica → SIN_GENERACION (falla real)", () => {
  const r = diagnosticar(entrada({ historial: serie([10, 12, 0]) }));
  assert.equal(r.diagnostico, "SIN_GENERACION");
  assert.equal(r.alerta, true);
  assert.equal(r.diasSinGeneracion, 1);
  assert.equal(r.ultimaGeneracionEn, "2026-08-05");
  assert.match(r.detalle, /alterna/);
});

test("no genera y no se pudo leer el estado del equipo", () => {
  const r = diagnosticar(entrada({ historial: serie([10, 0]), dispositivos: [] }));
  // Sin dispositivos no hay comunicación demostrable: se informa como caída.
  assert.equal(r.diagnostico, "SIN_COMUNICACION");
  assert.equal(r.alerta, true);
});

test("con umbral de 2 días, un solo día flojo no alerta", () => {
  const umbrales = { ...UMBRALES_DEFAULT, diasSinGeneracion: 2 };
  const unDia = diagnosticar(entrada({ historial: serie([10, 10, 0]), umbrales }));
  assert.equal(unDia.diagnostico, "OK");

  const dosDias = diagnosticar(entrada({ historial: serie([10, 0, 0]), umbrales }));
  assert.equal(dosDias.diagnostico, "SIN_GENERACION");
});

// ─── Cascada de habilitación ────────────────────────────────────────────────

const SIN_DATOS = { postHabilitacionInicioEn: null, actualUteEnd: null, uteProcesses: [], stages: [] };

test("resolverHabilitadoEn prioriza el ancla del traspaso T8", () => {
  const ancla = new Date("2026-03-01T00:00:00.000Z");
  const r = resolverHabilitadoEn({
    ...SIN_DATOS,
    postHabilitacionInicioEn: ancla,
    actualUteEnd: new Date("2026-01-01T00:00:00.000Z"),
    uteProcesses: [{ currentStage: "FINALIZADO", finalizedAt: new Date("2026-02-01T00:00:00.000Z") }],
  });
  assert.equal(r?.toISOString(), ancla.toISOString());
});

test("resolverHabilitadoEn cae al trámite, después a la etapa y después a actualUteEnd", () => {
  const tramite = new Date("2026-02-01T00:00:00.000Z");
  assert.equal(
    resolverHabilitadoEn({ ...SIN_DATOS, uteProcesses: [{ currentStage: "FINALIZADO", finalizedAt: tramite }] })?.getTime(),
    tramite.getTime(),
  );

  const etapa = new Date("2026-01-15T00:00:00.000Z");
  assert.equal(
    resolverHabilitadoEn({ ...SIN_DATOS, stages: [{ name: "TRAMITACION_UTE", actualEndDate: etapa }] })?.getTime(),
    etapa.getTime(),
  );

  // El nombre viejo de la etapa tiene que valer igual: en prod conviven los dos.
  assert.equal(
    resolverHabilitadoEn({ ...SIN_DATOS, stages: [{ name: "HABILITACION_UTE", actualEndDate: etapa }] })?.getTime(),
    etapa.getTime(),
  );

  const legacy = new Date("2025-12-01T00:00:00.000Z");
  assert.equal(resolverHabilitadoEn({ ...SIN_DATOS, actualUteEnd: legacy })?.getTime(), legacy.getTime());
});

test("resolverOperativaDesde cae al mes de inicio de reportes", () => {
  const hab = new Date("2026-01-01T00:00:00.000Z");
  const mes = new Date("2024-03-01T00:00:00.000Z");

  // La habilitación manda cuando existe.
  assert.deepEqual(resolverOperativaDesde({ habilitadoEn: hab, mesInicioReportes: mes }), {
    desde: hab,
    fuente: "habilitacion",
  });

  // El caso real: 73% de los generadores no tiene fecha de habilitación, pero
  // les venimos mandando el reporte mensual desde hace años. Sin este escalón el
  // monitoreo los silenciaba a todos.
  assert.deepEqual(resolverOperativaDesde({ habilitadoEn: null, mesInicioReportes: mes }), {
    desde: mes,
    fuente: "reportes",
  });

  // Sin ninguna de las dos, sigue callado: es una instalación que no arrancó.
  assert.deepEqual(resolverOperativaDesde({ habilitadoEn: null, mesInicioReportes: null }), {
    desde: null,
    fuente: null,
  });
});

test("resolverHabilitadoEn no inventa una fecha cuando no la hay", () => {
  assert.equal(resolverHabilitadoEn(SIN_DATOS), null);
  // Trámite finalizado pero sin ninguna fecha: se calla en vez de suponer hoy.
  assert.equal(
    resolverHabilitadoEn({ ...SIN_DATOS, uteProcesses: [{ currentStage: "FINALIZADO", finalizedAt: null }] }),
    null,
  );
  // Una etapa de UTE sin fecha de cierre tampoco alcanza.
  assert.equal(
    resolverHabilitadoEn({ ...SIN_DATOS, stages: [{ name: "TRAMITACION_UTE", actualEndDate: null }] }),
    null,
  );
});
