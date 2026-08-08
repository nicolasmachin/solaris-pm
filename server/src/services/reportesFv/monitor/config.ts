// Configuración del monitoreo diario, en UN solo lugar.
//
// `REPORTE_SEMANAL_EMAIL` quedó hardcodeada en tres archivos distintos y ya
// costó una tarde encontrar todos. Acá no: todo lo que se puede tocar por env
// se lee desde acá.

export const CRON_DEFAULT = "0 8 * * *";

/**
 * Lee una variable numérica tratando la cadena vacía como "no configurada".
 *
 * Docker Compose pasa "" cuando el compose declara `${VAR:-}` y el .env no
 * define VAR. Como `Number("")` es 0, sin este guard un rango que acepte el
 * cero se queda con el cero en vez de con su default — que fue exactamente el
 * bug que dejó el umbral de generación en 0 kWh en producción.
 */
function envNum(clave: string, def: number, valido: (v: number) => boolean): number {
  const raw = process.env[clave];
  if (raw == null || raw.trim() === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) && valido(v) ? v : def;
}

/**
 * Concurrencia entre plantas. Baja a propósito: el spike contra la API real
 * mostró que el rate limit (error_code 10012) aparece mucho antes de lo que
 * decía la documentación, incluso con la pausa de 700 ms entre requests. El
 * cron no tiene apuro — 150 plantas a este ritmo son unos pocos minutos.
 */
export function concurrencia(): number {
  return Math.floor(envNum("FV_MONITOR_CONCURRENCIA", 1, (v) => v >= 1));
}

/** ¿Está habilitado el cron? */
export function monitorHabilitado(): boolean {
  return process.env.FV_MONITOR_ENABLED !== "false";
}

/**
 * ¿Se manda el digest? Kill-switch por si algún día genera ruido; se arranca
 * prendido.
 */
export function emailHabilitado(): boolean {
  return process.env.FV_MONITOR_EMAIL_ENABLED !== "false";
}

/**
 * Destinatarios del digest. Por ahora sólo Nicolás: el monitoreo es interno y
 * todavía no está validado como para avisarle al resto del equipo.
 *
 * OJO al cambiarlo: el digest se manda como `internal`, y ese modo de
 * `sendEmail` BLOQUEA (devolviendo false, en silencio) cualquier destinatario
 * que no sea un usuario vivo de la aplicación. Si acá se pone una casilla
 * externa, hay que pasar el envío a `client_facing` en `digest.email.ts` o el
 * mail deja de salir sin que nadie se entere.
 */
export function destinatariosMonitor(): string[] {
  const raw = process.env.FV_MONITOR_EMAIL || "nmachin@voltia.com.uy";
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

/**
 * Fracción de la flota con el mismo problema a partir de la cual se asume que
 * el problema es del clima o de Growatt, no de 60 clientes a la vez.
 */
export function pctAlertaMasiva(): number {
  return envNum("FV_MONITOR_ALERTA_MASIVA_PCT", 0.4, (v) => v > 0 && v <= 1);
}

/** Fracción de plantas que puede fallar antes de dar la corrida por rota. */
export function pctErrorMasivo(): number {
  return envNum("FV_MONITOR_ERROR_MASIVO_PCT", 0.3, (v) => v > 0 && v <= 1);
}

/**
 * Día de la semana en que el digest sale igual aunque no haya novedades, para
 * que una incidencia abierta no se pudra en silencio durante semanas.
 * 1 = lunes (JS: 0 = domingo).
 */
export function diaResumenSemanal(): number {
  // Acá el cero es un valor legítimo (domingo), así que el guard de cadena
  // vacía no es un detalle: sin él, en producción el resumen semanal se
  // mudaba del lunes al domingo sin que nadie lo pidiera.
  return envNum("FV_MONITOR_DIGEST_SEMANAL_DOW", 1, (v) => v >= 0 && v <= 6);
}
