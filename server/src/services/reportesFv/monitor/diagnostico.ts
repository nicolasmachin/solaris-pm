// ¿Qué le pasa a esta planta? — lógica pura, sin I/O, con `ahora` inyectado.
//
// ── Qué expone realmente la API (spike del 7/8/2026, plan A) ─────────────────
// La Growatt Open API v1 NO tiene endpoint de alarmas: `inverter/alarm` y
// `device/fault` no existen. Lo que sí hay, verificado contra la API real:
//
//   device/list             → lost, status, last_update_time, device_sn, model,
//                             type (7 = inversor MIN/TLX, 3 = medidor).
//                             1 request por planta, el mismo que ya se hacía.
//   device/tlx/tlx_last_data (POST estricto; por GET devuelve HTTP 405)
//                           → faultType, warnCode, sysFaultWord1..7,
//                             deratingMode, statusText ("Normal"), errorText,
//                             warnText. Es el ÚNICO lugar con códigos de falla.
//
// Por eso el diagnóstico puede decir *qué* falla y no sólo *que* falla. Como el
// rate limit de Growatt es agresivo (error_code 10012 aparece enseguida), el
// detalle del inversor se pide sólo para las plantas ya sospechosas.
//
// Dato de campo que condiciona todo: el datalogger se alimenta del inversor y
// sólo transmite con luz solar (~08:00–18:30). "Sin datos" de noche es normal.

import { FvDiagnostico } from "@prisma/client";
import { diasEntre, diaTexto, sumarDias, type Dia } from "./dias.js";

export interface EstadoDispositivo {
  deviceSn: string;
  /** 1=inverter, 3=medidor, 4=max, 5=sph, 7=min/TLX. */
  tipo: number;
  lost: boolean | null;
  ultimoDatoEn: Date | null;
  statusRaw: number | null;
  faultCode: number | null;
  warnCode: number | null;
  faultTexto: string | null;
}

export interface UmbralesMonitor {
  /** kWh por debajo de los cuales el día cuenta como "no generó". */
  generacionMinimaKwh: number;
  /** Días consecutivos sin generar para que amerite alerta. */
  diasSinGeneracion: number;
  /** Horas sin dato del equipo para darlo por incomunicado. */
  horasSinComunicacion: number;
  /** Días de gracia después de habilitar antes de exigir generación. */
  diasGraciaHabilitacion: number;
  /** Días seguidos sin respuesta de Growatt antes de que eso sí sea alerta. */
  diasSinDatosApi: number;
}

export const UMBRALES_DEFAULT: UmbralesMonitor = {
  // Intencionalmente bajísimo. En Uruguay una planta sana da más de 0,5 kWh
  // incluso el peor día nublado de junio; sólo da cero si algo está roto. Ese
  // es el motivo por el que el criterio funciona igual en invierno que en
  // verano, sin comparar contra ningún histórico.
  generacionMinimaKwh: 0.5,
  diasSinGeneracion: 1,
  // 36 y no 24: con el cron a las 08:00, un datalogger sano transmitió ayer
  // 18:30 (13,5 h) y uno muerto anteayer lleva 37,5 h. 24 h daría falso
  // positivo cualquier día nublado con arranque tardío. Este margen es lo que
  // permite correr el cron temprano sin que las plantas sanas —que a esa hora
  // todavía no transmitieron— aparezcan como caídas.
  horasSinComunicacion: 36,
  diasGraciaHabilitacion: 3,
  diasSinDatosApi: 3,
};

export interface EntradaDiagnostico {
  /** Día evaluado (siempre el anterior al de la corrida). */
  dia: Dia;
  /** kWh del día evaluado. null = Growatt no devolvió ese día. */
  generacionKwh: number | null;
  /** Últimos ~7 días, incluido el evaluado. */
  historial: Map<Dia, number>;
  /** Cascada canónica; null = todavía no habilitada. */
  habilitadoEn: Date | null;
  /** Vacío = no se pudo consultar device/list. */
  dispositivos: EstadoDispositivo[];
  silenciadaHasta: Date | null;
  /** Corridas anteriores consecutivas que tampoco pudieron consultar la API. */
  diasSeguidosSinDatosApi: number;
  umbrales: UmbralesMonitor;
  ahora: Date;
}

export interface ResultadoDiagnostico {
  diagnostico: FvDiagnostico;
  diasSinGeneracion: number;
  ultimaGeneracionEn: Dia | null;
  /** Frase corta en castellano, lista para el mail y para el panel. */
  detalle: string;
  /** ¿Amerita abrir o mantener una incidencia? */
  alerta: boolean;
}

// ─── Helpers puros (exportados para poder testearlos sueltos) ────────────────

/** Días consecutivos sin generar terminando en `hasta`. Los días sin dato cortan. */
export function contarDiasSinGeneracion(
  historial: Map<Dia, number>,
  hasta: Dia,
  minKwh: number,
): number {
  let dias = 0;
  let cursor = hasta;
  // Tope duro: el historial que se pide es de una semana, más que eso no se sabe.
  for (let i = 0; i < 31; i++) {
    const kwh = historial.get(cursor);
    if (kwh == null) break;
    if (kwh >= minKwh) break;
    dias++;
    cursor = sumarDias(cursor, -1);
  }
  return dias;
}

/** Último día con generación real, mirando hacia atrás desde `hasta`. */
export function ultimoDiaConGeneracion(
  historial: Map<Dia, number>,
  hasta: Dia,
  minKwh: number,
): Dia | null {
  let cursor = hasta;
  for (let i = 0; i < 31; i++) {
    const kwh = historial.get(cursor);
    if (kwh != null && kwh >= minKwh) return cursor;
    cursor = sumarDias(cursor, -1);
  }
  return null;
}

/**
 * ¿Hay algún equipo comunicando? Se mira `ultimoDatoEn` y no el booleano `lost`:
 * de noche todos los dataloggers están "perdidos" y eso no es una falla.
 * Sin `ultimoDatoEn`, `lost` es el único indicio y se usa como respaldo.
 */
export function hayComunicacion(
  dispositivos: EstadoDispositivo[],
  ahora: Date,
  horas: number,
): boolean {
  if (dispositivos.length === 0) return false;
  const limite = ahora.getTime() - horas * 3_600_000;
  for (const d of dispositivos) {
    if (d.ultimoDatoEn != null) {
      if (d.ultimoDatoEn.getTime() >= limite) return true;
    } else if (d.lost === false) {
      return true;
    }
  }
  return false;
}

/** El equipo más recientemente visto, para poder decir desde cuándo no reporta. */
export function ultimaComunicacion(dispositivos: EstadoDispositivo[]): Date | null {
  let max: Date | null = null;
  for (const d of dispositivos) {
    if (d.ultimoDatoEn && (max == null || d.ultimoDatoEn > max)) max = d.ultimoDatoEn;
  }
  return max;
}

export interface FallaInversor {
  deviceSn: string;
  code: number;
  texto: string | null;
  esAdvertencia: boolean;
}

/** Falla o advertencia activa de algún inversor. El medidor (tipo 3) no cuenta. */
export function fallaActiva(dispositivos: EstadoDispositivo[]): FallaInversor | null {
  for (const d of dispositivos) {
    if (d.tipo === 3) continue;
    if (d.faultCode != null && d.faultCode !== 0) {
      return { deviceSn: d.deviceSn, code: d.faultCode, texto: d.faultTexto, esAdvertencia: false };
    }
  }
  for (const d of dispositivos) {
    if (d.tipo === 3) continue;
    if (d.warnCode != null && d.warnCode !== 0) {
      return { deviceSn: d.deviceSn, code: d.warnCode, texto: d.faultTexto, esAdvertencia: true };
    }
  }
  return null;
}

export function leerUmbrales(env: NodeJS.ProcessEnv = process.env): UmbralesMonitor {
  const num = (clave: string, def: number): number => {
    // La cadena vacía NO es un cero: es "la variable no está configurada".
    // Docker Compose pasa "" cuando el compose declara `${VAR:-}` y el .env no
    // define VAR, y `Number("")` es 0. Sin este guard, en producción el umbral
    // de generación quedaba en 0 kWh y una planta muerta —que genera
    // exactamente 0— pasaba como "funcionando": el monitoreo se volvía ciego
    // sin dar ninguna señal de que algo andaba mal.
    const raw = env[clave];
    if (raw == null || String(raw).trim() === "") return def;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : def;
  };
  return {
    generacionMinimaKwh: num("FV_MONITOR_KWH_MIN", UMBRALES_DEFAULT.generacionMinimaKwh),
    diasSinGeneracion: Math.max(1, num("FV_MONITOR_DIAS", UMBRALES_DEFAULT.diasSinGeneracion)),
    horasSinComunicacion: num("FV_MONITOR_HORAS_SIN_COMS", UMBRALES_DEFAULT.horasSinComunicacion),
    diasGraciaHabilitacion: num("FV_MONITOR_DIAS_GRACIA", UMBRALES_DEFAULT.diasGraciaHabilitacion),
    diasSinDatosApi: num("FV_MONITOR_DIAS_SIN_DATOS_API", UMBRALES_DEFAULT.diasSinDatosApi),
  };
}

// ─── El diagnóstico ─────────────────────────────────────────────────────────

/**
 * Primer match gana. El orden es deliberado: "esperando habilitación" se
 * resuelve ANTES de mirar la generación, así una planta que todavía no se
 * encendió nunca genera una alerta.
 */
export function diagnosticar(e: EntradaDiagnostico): ResultadoDiagnostico {
  const { umbrales: u } = e;
  const minKwh = u.generacionMinimaKwh;
  const ultimaGeneracionEn = ultimoDiaConGeneracion(e.historial, e.dia, minKwh);
  const diasSinGeneracion = contarDiasSinGeneracion(e.historial, e.dia, minKwh);

  const base = { diasSinGeneracion, ultimaGeneracionEn };

  // 1. Silenciada a mano.
  if (e.silenciadaHasta && e.silenciadaHasta >= new Date(`${e.dia}T00:00:00.000Z`)) {
    return {
      ...base,
      diagnostico: FvDiagnostico.SILENCIADA,
      detalle: `Monitoreo silenciado hasta el ${diaTexto(e.silenciadaHasta.toISOString().slice(0, 10))}.`,
      alerta: false,
    };
  }

  // 2. Todavía no habilitada: es lo esperable, no un problema.
  if (e.habilitadoEn == null) {
    return {
      ...base,
      diagnostico: FvDiagnostico.ESPERANDO_HABILITACION,
      detalle: "El proyecto todavía no completó la habilitación de UTE.",
      alerta: false,
    };
  }

  // 3. Habilitada hace muy poco: el cliente puede no haberla encendido aún.
  const habilitadoDia = e.habilitadoEn.toISOString().slice(0, 10);
  const diasDesdeHabilitacion = diasEntre(habilitadoDia, e.dia);
  if (diasDesdeHabilitacion < u.diasGraciaHabilitacion) {
    return {
      ...base,
      diagnostico: FvDiagnostico.ESPERANDO_HABILITACION,
      detalle: `Habilitada el ${diaTexto(habilitadoDia)}; puede no estar encendida todavía.`,
      alerta: false,
    };
  }

  // 4. Growatt no contestó. Es un problema NUESTRO, no del cliente: sólo se
  //    convierte en alerta si se repite varios días (una caída puntual de la API
  //    no puede generar 150 incidencias falsas).
  if (e.generacionKwh == null && !e.historial.has(e.dia)) {
    const racha = e.diasSeguidosSinDatosApi + 1;
    return {
      ...base,
      diagnostico: FvDiagnostico.SIN_DATOS_API,
      detalle:
        racha >= u.diasSinDatosApi
          ? `Growatt no devuelve datos de esta planta hace ${racha} días.`
          : "Growatt no devolvió datos de esta planta.",
      alerta: racha >= u.diasSinDatosApi,
    };
  }

  // 5. Generó: todo bien.
  if (diasSinGeneracion < u.diasSinGeneracion) {
    const kwh = e.historial.get(e.dia) ?? e.generacionKwh ?? 0;
    return {
      ...base,
      diagnostico: FvDiagnostico.OK,
      detalle: `Generó ${kwh.toFixed(1)} kWh.`,
      alerta: false,
    };
  }

  // 6. No generó. La causa la deciden los dispositivos.
  const desde = ultimaGeneracionEn
    ? `desde el ${diaTexto(sumarDias(ultimaGeneracionEn, 1))}`
    : `hace ${diasSinGeneracion} ${diasSinGeneracion === 1 ? "día" : "días"}`;

  const falla = fallaActiva(e.dispositivos);
  if (falla) {
    const que = falla.texto ? `${falla.texto} (código ${falla.code})` : `código ${falla.code}`;
    return {
      ...base,
      diagnostico: FvDiagnostico.ERROR_DISPOSITIVO,
      detalle: `El inversor ${falla.deviceSn} reporta ${
        falla.esAdvertencia ? "una advertencia" : "una falla"
      }: ${que}. No genera ${desde}.`,
      alerta: true,
    };
  }

  if (!hayComunicacion(e.dispositivos, e.ahora, u.horasSinComunicacion)) {
    const ultima = ultimaComunicacion(e.dispositivos);
    const cuando = ultima
      ? `El equipo no reporta desde el ${diaTexto(ultima.toISOString().slice(0, 10))}.`
      : "El equipo no está reportando a Growatt.";
    return {
      ...base,
      diagnostico: FvDiagnostico.SIN_COMUNICACION,
      detalle: `${cuando} Suele ser el wifi de la casa (cambio de router o de clave), o la planta apagada.`,
      alerta: true,
    };
  }

  if (e.dispositivos.length === 0) {
    return {
      ...base,
      diagnostico: FvDiagnostico.SIN_GENERACION,
      detalle: `No generó ${desde} y no se pudo leer el estado del equipo.`,
      alerta: true,
    };
  }

  return {
    ...base,
    diagnostico: FvDiagnostico.SIN_GENERACION,
    detalle: `El equipo está comunicando pero no genera ${desde}. Falla del inversor o corte del lado de alterna.`,
    alerta: true,
  };
}

/** Etiquetas para el mail y el panel. */
export const DIAGNOSTICO_LABEL: Record<FvDiagnostico, string> = {
  OK: "Funcionando",
  GENERACION_BAJA: "Generación baja",
  SIN_GENERACION: "No genera",
  SIN_COMUNICACION: "Sin comunicación",
  ERROR_DISPOSITIVO: "Falla del equipo",
  SIN_EXPORTACION: "No inyecta a la red",
  ESPERANDO_HABILITACION: "Esperando habilitación",
  SILENCIADA: "Silenciada",
  SIN_DATOS_API: "Sin datos de Growatt",
};
