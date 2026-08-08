// Configuración del monitoreo diario, en UN solo lugar.
//
// `REPORTE_SEMANAL_EMAIL` quedó hardcodeada en tres archivos distintos y ya
// costó una tarde encontrar todos. Acá no: todo lo que se puede tocar por env
// se lee desde acá.

export const CRON_DEFAULT = "0 8 * * *";

/**
 * Concurrencia entre plantas. Baja a propósito: el spike contra la API real
 * mostró que el rate limit (error_code 10012) aparece mucho antes de lo que
 * decía la documentación, incluso con la pausa de 700 ms entre requests. El
 * cron no tiene apuro — 150 plantas a este ritmo son unos pocos minutos.
 */
export function concurrencia(): number {
  const v = Number(process.env.FV_MONITOR_CONCURRENCIA);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
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
  const v = Number(process.env.FV_MONITOR_ALERTA_MASIVA_PCT);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.4;
}

/** Fracción de plantas que puede fallar antes de dar la corrida por rota. */
export function pctErrorMasivo(): number {
  const v = Number(process.env.FV_MONITOR_ERROR_MASIVO_PCT);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.3;
}

/**
 * Día de la semana en que el digest sale igual aunque no haya novedades, para
 * que una incidencia abierta no se pudra en silencio durante semanas.
 * 1 = lunes (JS: 0 = domingo).
 */
export function diaResumenSemanal(): number {
  const v = Number(process.env.FV_MONITOR_DIGEST_SEMANAL_DOW);
  return Number.isFinite(v) && v >= 0 && v <= 6 ? v : 1;
}
