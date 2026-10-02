// Reporte mensual de indicadores por email.
//
// El día 1 de cada mes a las 00:01 (hora de Uruguay) manda los indicadores del
// mes que acaba de cerrar, con la comparación contra el mes anterior. Usa las
// mismas cuentas y el mismo formato que el reporte semanal
// (`reporte-semanal.job.ts`): solo cambia el período.

import cron from "node-cron";

import { sendEmail } from "../email.service.js";
import {
  aRelojMvd,
  desdeRelojMvd,
  destinatario,
  recolectarIndicadores,
  renderIndicadoresHtml,
  renderIndicadoresTexto,
  type IndicadoresPeriodo,
} from "./reporte-semanal.job.js";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export interface RangoMes {
  /** Instante UTC del día 1 a las 00:00 (hora Uruguay). */
  inicio: Date;
  /** Instante UTC del día 1 del mes siguiente: el mes es [inicio, fin). */
  fin: Date;
  anio: number;
  mes: number; // 1..12
  /** Ej. "septiembre de 2026". */
  etiqueta: string;
}

function rangoMes(anio: number, mes0: number): RangoMes {
  const inicioPared = new Date(Date.UTC(anio, mes0, 1, 0, 0, 0));
  const finPared = new Date(Date.UTC(anio, mes0 + 1, 1, 0, 0, 0));
  const a = inicioPared.getUTCFullYear();
  const m = inicioPared.getUTCMonth();
  return {
    inicio: desdeRelojMvd(inicioPared),
    fin: desdeRelojMvd(finPared),
    anio: a,
    mes: m + 1,
    etiqueta: `${MESES[m]} de ${a}`,
  };
}

/**
 * Mes que YA cerró al momento `now` (hora Uruguay). Corriendo el 1 de octubre
 * a las 00:01 devuelve septiembre; corriendo el 15 de octubre, también.
 */
export function calcularMesCerrado(now: Date): RangoMes {
  const pared = aRelojMvd(now);
  return rangoMes(pared.getUTCFullYear(), pared.getUTCMonth() - 1);
}

export function mesAnterior(m: RangoMes): RangoMes {
  return rangoMes(m.anio, m.mes - 2);
}

export interface DatosReporteMensual extends IndicadoresPeriodo {
  mes: RangoMes;
  anterior: { mes: RangoMes; datos: IndicadoresPeriodo };
}

export async function recolectarDatosMensual(now: Date): Promise<DatosReporteMensual> {
  const mes = calcularMesCerrado(now);
  const previo = mesAnterior(mes);
  // Las metas se miden al cierre de cada mes: el 1 de octubre muestra cómo
  // terminó el tercer trimestre, no el arranque del cuarto.
  const [datos, datosPrevio] = await Promise.all([
    recolectarIndicadores(mes, mes.fin),
    recolectarIndicadores(previo, previo.fin),
  ]);
  return { mes, ...datos, anterior: { mes: previo, datos: datosPrevio } };
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function renderHtmlMensual(d: DatosReporteMensual): string {
  return renderIndicadoresHtml(d, {
    kicker: "Reporte mensual de indicadores",
    titulo: capitalizar(d.mes.etiqueta),
    subtitulo: `Del 1 al ${aRelojMvd(new Date(d.mes.fin.getTime() - 1)).getUTCDate()} de ${MESES[d.mes.mes - 1]}`,
    enElPeriodo: "en el mes",
    pie: "Generado automáticamente el día 1 de cada mes a las 00:01 (hora Uruguay) por Voltia PM.",
    anterior: { etiqueta: capitalizar(MESES[d.anterior.mes.mes - 1]), datos: d.anterior.datos },
  });
}

export function renderTextoMensual(d: DatosReporteMensual): string {
  return renderIndicadoresTexto(d, `Reporte mensual · ${capitalizar(d.mes.etiqueta)}`, `Comparado con ${d.anterior.mes.etiqueta}`);
}

export async function ejecutarReporteMensual(now: Date = new Date()): Promise<boolean> {
  const datos = await recolectarDatosMensual(now);
  const to = destinatario();
  const ok = await sendEmail({
    to,
    // Mismo criterio que el semanal: el destinatario puede ser una casilla externa.
    type: "client_facing",
    subject: `Indicadores · ${capitalizar(datos.mes.etiqueta)}`,
    html: renderHtmlMensual(datos),
    text: renderTextoMensual(datos),
  });
  if (ok) console.log(`[reporte-mensual] enviado a ${to} — ${datos.mes.etiqueta}`);
  else console.warn("[reporte-mensual] no se pudo enviar (¿SMTP configurado?)");
  return ok;
}

export function startReporteMensualJob() {
  if (process.env.REPORTE_MENSUAL_ENABLED === "false") {
    console.log("[reporte-mensual] deshabilitado por REPORTE_MENSUAL_ENABLED=false");
    return null;
  }
  // Día 1 de cada mes, 00:01 hora de Uruguay.
  const expr = process.env.CRON_REPORTE_MENSUAL || "1 0 1 * *";
  return cron.schedule(
    expr,
    async () => {
      try {
        await ejecutarReporteMensual();
      } catch (err) {
        console.error("[reporte-mensual] error:", err);
      }
    },
    { timezone: "America/Montevideo" },
  );
}
