import cron from "node-cron";

import { billerConfigurado } from "./recibidos.service.js";
import { seguirCfesPendientes } from "./cfe-emitidos.service.js";

/**
 * Sigue el estado ante DGI de las facturas y notas de crédito que emitió Voltia
 * (y vuelve a buscar las dudosas). Solo lee: nunca emite. Sin BILLER_TOKEN no corre.
 */
export function startBillerCfeEmitidosJob() {
  if (!billerConfigurado()) return null;
  const expr = process.env.CRON_BILLER_CFE || "*/5 * * * *";
  return cron.schedule(expr, async () => {
    try {
      await seguirCfesPendientes();
    } catch (err) {
      console.error("[biller-cfe] error:", (err as Error).message);
    }
  }, { timezone: "America/Montevideo" });
}
