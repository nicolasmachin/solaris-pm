// Cron del monitoreo diario de plantas.

import cron from "node-cron";
import { FvMonitorCorridaModo } from "@prisma/client";

import { CRON_DEFAULT, monitorHabilitado } from "./config.js";
import { enviarDigest } from "./digest.email.js";
import { ejecutarMonitorDiario } from "./monitor.service.js";
import { sincronizarPlantas } from "../growatt/plantas.service.js";

/**
 * Todos los días a las 08:00 de Uruguay, evaluando el día anterior completo.
 *
 * Que a esa hora el datalogger todavía no haya arrancado (se alimenta del
 * inversor y sólo transmite con sol) NO rompe el diagnóstico: la falta de
 * comunicación se mide contra `ultimoDatoEn` con una ventana de 36 h, así que un
 * equipo sano que transmitió ayer 18:30 lleva 13,5 h y sigue dando OK. Lo que
 * importa es no correrlo de madrugada, donde esa ventana sí se acorta de más.
 * Además deja margen con la ingesta mensual, que corre los días 2, 4 y 6 a las
 * 06:00.
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
        // Sincronizar primero: una planta instalada ayer entra al monitoreo hoy
        // sin que nadie tenga que apretar un botón. Si falla, el monitoreo sigue
        // igual con el catálogo que ya tiene.
        try {
          const s = await sincronizarPlantas();
          if (s.nuevas > 0 || s.ajenas > 0) {
            console.log(
              `[fv-monitor] catálogo: ${s.nuevas} plantas nuevas, ${s.ajenas} de otra cuenta descartadas, ` +
                `${s.sinVincular} sin vincular`,
            );
          }
        } catch (err) {
          console.error("[fv-monitor] no se pudo sincronizar el catálogo:", err);
        }

        const resumen = await ejecutarMonitorDiario(new Date(), { modo: FvMonitorCorridaModo.CRON });
        await enviarDigest(resumen);
      } catch (err) {
        console.error("[fv-monitor] error:", err);
      }
    },
    { timezone: "America/Montevideo" },
  );
}
