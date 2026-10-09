import cron from "node-cron";

import { billerConfigurado, sincronizarYRegistrar } from "./recibidos.service.js";

/**
 * Trae de Biller las facturas recibidas de proveedores, cada hora en horario
 * de oficina. Sin BILLER_TOKEN no corre (desarrollo sin cuenta, por ejemplo).
 */
export function startBillerRecibidosJob() {
  if (!billerConfigurado()) return null;
  const expr = process.env.CRON_BILLER_RECIBIDOS || "15 8-20 * * 1-6";
  return cron.schedule(expr, async () => {
    const r = await sincronizarYRegistrar();
    if (!r.ok) console.error("[biller-recibidos] error:", r.error);
    else if (r.resultado && (r.resultado.nuevas || r.resultado.actualizadas)) {
      console.log(`[biller-recibidos] nuevas ${r.resultado.nuevas}, actualizadas ${r.resultado.actualizadas}`);
    }
  }, { timezone: "America/Montevideo" });
}
