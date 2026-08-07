// Cron del monitoreo diario de plantas.

import cron from "node-cron";
import { FvMonitorCorridaModo } from "@prisma/client";

import { CRON_DEFAULT, monitorHabilitado } from "./config.js";
import { enviarDigest } from "./digest.email.js";
import { ejecutarMonitorDiario } from "./monitor.service.js";

/**
 * Todos los días a las 09:30 de Uruguay, evaluando el día anterior completo.
 *
 * La hora no es arbitraria: a las 06:00 TODAS las plantas parecerían
 * incomunicadas, porque el datalogger se alimenta del inversor y no vuelve a
 * transmitir hasta que sale el sol. A las 09:30 las sanas ya reportaron y la
 * señal discrimina de verdad. Además deja margen con la ingesta mensual, que
 * corre los días 2, 4 y 6 a las 06:00.
 *
 * Va con su propia env (CRON_FV_MONITOR) y no dentro de startReportesFvJobs()
 * para que su kill-switch sea independiente del pipeline mensual.
 */
export function startFvMonitorJob() {
  if (!monitorHabilitado()) {
    console.log("[fv-monitor] deshabilitado por FV_MONITOR_ENABLED=false");
    return null;
  }
  const expr = process.env.CRON_FV_MONITOR || CRON_DEFAULT;
  return cron.schedule(
    expr,
    async () => {
      try {
        const resumen = await ejecutarMonitorDiario(new Date(), { modo: FvMonitorCorridaModo.CRON });
        await enviarDigest(resumen);
      } catch (err) {
        console.error("[fv-monitor] error:", err);
      }
    },
    { timezone: "America/Montevideo" },
  );
}
