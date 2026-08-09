// Árbol de decisión del monitoreo para plantas Huawei (FusionSolar).
//
// Archivo aparte de `diagnostico.ts` y no una rama dentro de él: las señales de
// entrada son distintas. En Growatt hay que INFERIR la falla ("comunica pero no
// genera") porque la Open API v1 no tiene endpoint de alarmas; en Huawei la API
// dice el estado con `real_health_state` y lo único que hace falta es traducirlo.
// Meterlos en la misma función obligaría a inventar campos vacíos de un lado y
// del otro.
//
// Sale al mismo enum `FvDiagnostico`, así que el mail, el panel y las
// incidencias tratan a las dos marcas igual.

import { FvDiagnostico } from "@prisma/client";

import type { Dia } from "./dias.js";
import { diasEntre } from "./dias.js";

/**
 * `real_health_state` de `getStationRealKpi`.
 *
 * OJO con el 1: significa SIN COMUNICACIÓN, no "planta rota". Verificado en
 * campo el 8-ago-2026 — Rodolfo Sosa da 1 y la planta funciona bien; lo que
 * falla es el wifi del inversor. Traducirlo como avería mandaría a un técnico a
 * mirar un inversor sano.
 */
export type EstadoSalud = 1 | 2 | 3;

export interface EntradaDiagnosticoHuawei {
  /** Día evaluado (normalmente ayer). */
  dia: Dia;
  /** kWh del día evaluado. null = la API no lo trajo. */
  generacionKwh: number | null;
  /** Últimos días con su generación, del más viejo al más nuevo. */
  historial: { dia: Dia; generacionKwh: number }[];
  estadoSalud: EstadoSalud | null;
  /** null = todavía no habilitada por UTE. */
  habilitadoEn: Dia | null;
  silenciadaHasta: Dia | null;
  umbrales: Umbrales;
}

export interface Umbrales {
  kwhMinimo: number;
  diasSinGeneracion: number;
  diasGraciaHabilitacion: number;
}

export interface ResultadoDiagnosticoHuawei {
  diagnostico: FvDiagnostico;
  diasSinGeneracion: number;
  ultimaGeneracionEn: Dia | null;
  detalle: string;
  alerta: boolean;
}

export function leerUmbralesHuawei(env: NodeJS.ProcessEnv = process.env): Umbrales {
  // Una env vacía (`FOO=` o el `${FOO:-}` de docker-compose) llega como "" y
  // Number("") es 0, que apagaría el umbral sin que nadie se entere. Ya pasó una
  // vez con el monitor de Growatt: plantas generando 0.00 kWh se reportaban OK.
  const leer = (clave: string, def: number): number => {
    const raw = env[clave];
    if (raw == null || String(raw).trim() === "") return def;
    const n = Number(raw);
    return Number.isFinite(n) ? n : def;
  };
  return {
    kwhMinimo: leer("FV_MONITOR_KWH_MIN", 0.5),
    diasSinGeneracion: leer("FV_MONITOR_DIAS", 1),
    diasGraciaHabilitacion: leer("FV_MONITOR_DIAS_GRACIA", 3),
  };
}

/** Días consecutivos sin generar contando hacia atrás desde el día evaluado. */
function contarDiasSinGenerar(
  e: EntradaDiagnosticoHuawei,
): { dias: number; ultima: Dia | null } {
  const min = e.umbrales.kwhMinimo;
  const serie = [...e.historial].sort((a, b) => (a.dia < b.dia ? -1 : 1));

  let ultima: Dia | null = null;
  for (const d of serie) {
    if (d.generacionKwh >= min) ultima = d.dia;
  }

  let dias = 0;
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].generacionKwh >= min) break;
    dias++;
  }
  return { dias, ultima };
}

/**
 * Primer match gana. El orden importa: "esperando habilitación" se resuelve
 * ANTES de mirar generación, porque una planta que todavía no está habilitada
 * por UTE tiene que generar cero y avisar de eso sería ruido puro.
 */
export function diagnosticarHuawei(e: EntradaDiagnosticoHuawei): ResultadoDiagnosticoHuawei {
  const { dias, ultima } = contarDiasSinGenerar(e);
  const base = { diasSinGeneracion: dias, ultimaGeneracionEn: ultima };

  if (e.silenciadaHasta && e.silenciadaHasta >= e.dia) {
    return { ...base, diagnostico: FvDiagnostico.SILENCIADA, detalle: "monitoreo silenciado", alerta: false };
  }

  if (e.habilitadoEn == null) {
    return {
      ...base,
      diagnostico: FvDiagnostico.ESPERANDO_HABILITACION,
      detalle: "todavía sin fecha de habilitación de UTE",
      alerta: false,
    };
  }

  const diasDesdeHabilitacion = diasEntre(e.habilitadoEn, e.dia);
  if (diasDesdeHabilitacion < e.umbrales.diasGraciaHabilitacion) {
    return {
      ...base,
      diagnostico: FvDiagnostico.ESPERANDO_HABILITACION,
      detalle: `habilitada hace ${diasDesdeHabilitacion} día(s): todavía en puesta en marcha`,
      alerta: false,
    };
  }

  // Estado 2 = falla declarada por el propio inversor. Es la única señal de
  // avería que tenemos de primera mano en cualquiera de las dos marcas.
  if (e.estadoSalud === 2) {
    return {
      ...base,
      diagnostico: FvDiagnostico.ERROR_DISPOSITIVO,
      detalle: "FusionSolar reporta el equipo en estado de falla",
      alerta: true,
    };
  }

  if (e.estadoSalud === 1) {
    return {
      ...base,
      diagnostico: FvDiagnostico.SIN_COMUNICACION,
      detalle:
        "el inversor no está llegando a FusionSolar; suele ser el wifi de la casa, no el equipo",
      alerta: true,
    };
  }

  // Sin dato del día y sin estado: no sabemos nada, y no se inventa.
  if (e.generacionKwh == null && e.estadoSalud == null) {
    return {
      ...base,
      diagnostico: FvDiagnostico.SIN_DATOS_API,
      detalle: "FusionSolar no devolvió datos de esta planta",
      alerta: false,
    };
  }

  if (dias < e.umbrales.diasSinGeneracion) {
    return { ...base, diagnostico: FvDiagnostico.OK, detalle: "generando normalmente", alerta: false };
  }

  // Comunica (estado 3) pero no genera: el equipo está prendido y hablando, así
  // que lo que falla es la producción — falla del inversor o corte de la CA.
  return {
    ...base,
    diagnostico: FvDiagnostico.SIN_GENERACION,
    detalle:
      `${dias} día(s) sin generar aunque el inversor comunica bien: ` +
      "falla de producción o corte de corriente en el tablero",
    alerta: true,
  };
}
