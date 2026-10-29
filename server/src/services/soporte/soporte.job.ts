import cron from "node-cron";

import { revisarRendimiento } from "./rendimiento.service.js";
import { correrVigia } from "./vigia.service.js";

/**
 * Prendido por defecto solo en producción: dev usa el mismo token de Growatt y
 * dos vigías compartirían el límite de consultas. En dev se corre a mano desde
 * la mesa (Revisar ahora) o con SOPORTE_VIGIA=1.
 */
export function vigiaHabilitado() {
  const v = process.env.SOPORTE_VIGIA;
  if (v === "0") return false;
  return v === "1" || process.env.NODE_ENV === "production";
}

export function startSoporteJobs() {
  if (!vigiaHabilitado()) {
    console.log("[soporte] vigía apagado (SOPORTE_VIGIA=1 para prenderlo fuera de producción)");
    return;
  }
  // Cada media hora de 7:00 a 20:30: de noche no hay sol y no hay nada que
  // mirar. Media hora alcanza (decidido el 28-oct-2026): lo que se busca es no
  // pasar días sin enterarse, no minutos.
  cron.schedule(
    process.env.CRON_SOPORTE_VIGIA || "*/30 7-20 * * *",
    async () => {
      try {
        const r = await correrVigia();
        if (r.casosNuevos || r.casosCerrados) {
          console.log(`[soporte] vigía: ${r.plantas} plantas, ${r.casosNuevos} casos nuevos, ${r.casosCerrados} cerrados`);
        }
      } catch (err) {
        console.error("[soporte] vigía:", err);
      }
    },
    { timezone: "America/Montevideo" },
  );
  // Bajo rendimiento: una vez por día, después del monitoreo de las 8 (que
  // carga la generación de ayer).
  cron.schedule(
    process.env.CRON_SOPORTE_RENDIMIENTO || "30 9 * * *",
    async () => {
      try {
        const r = await revisarRendimiento();
        if (r.abiertos || r.cerrados) console.log(`[soporte] rendimiento: ${r.abiertos} abiertos, ${r.cerrados} cerrados`);
      } catch (err) {
        console.error("[soporte] rendimiento:", err);
      }
    },
    { timezone: "America/Montevideo" },
  );
}
