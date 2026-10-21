import cron from "node-cron";

import { billerConfigurado, sincronizarYRegistrar } from "./recibidos.service.js";
import { cargarSolasCuentaCorriente } from "../finance/facturas-recibidas.service.js";

/**
 * Trae de Biller las facturas recibidas de proveedores cada media hora, todo el
 * día, y pasa solas a deuda las de proveedores de cuenta corriente. Sin
 * BILLER_TOKEN no corre (desarrollo sin cuenta, por ejemplo).
 */
export function startBillerRecibidosJob() {
  if (!billerConfigurado()) return null;
  const expr = process.env.CRON_BILLER_RECIBIDOS || "*/30 * * * *";
  return cron.schedule(expr, async () => {
    const r = await sincronizarYRegistrar();
    if (!r.ok) console.error("[biller-recibidos] error:", r.error);
    const solas = await cargarSolasCuentaCorriente().catch((e) => {
      console.error("[biller-recibidos] carga automática:", (e as Error).message);
      return null;
    });
    if (solas?.cargadas) console.log(`[biller-recibidos] ${solas.cargadas} factura(s) de cuenta corriente pasaron solas a deuda`);
    else if (r.resultado && (r.resultado.nuevas || r.resultado.actualizadas)) {
      console.log(`[biller-recibidos] nuevas ${r.resultado.nuevas}, actualizadas ${r.resultado.actualizadas}`);
    }
  }, { timezone: "America/Montevideo" });
}
