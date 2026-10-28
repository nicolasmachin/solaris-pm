// Qué le pasa a un inversor, a partir de su último dato. Puro (testeable).
//
// `plant/list` es barato pero grueso: muestra "en línea" con 0 W a una planta
// cuyo datalogger dejó de mandar datos hace una hora (Irigaray, 28-oct-2026:
// último dato 16:23 generando 3,5 kW). Por eso, antes de abrir un caso, se
// confirma con el último dato del inversor, que además dice por qué:
//   - dato viejo                       → no comunica
//   - código de falla                  → falla, con su explicación
//   - genera                           → falsa alarma (la lista venía atrasada)
//   - sin red y paneles con tensión    → la llave (aunque no haya código)
//   - paneles sin tensión, con sol     → corte del lado de los paneles
//   - todo con tensión y no genera     → inversor en espera o limitado

import { describirCodigo } from "./codigos.js";
import type { UltimoDatoInversor } from "../reportesFv/growatt/client.js";

/** Más viejo que esto, el inversor no está comunicando. */
export const DATO_VIEJO_MIN = 35;

export type Diagnostico =
  | { tipo: "GENERA" }
  | { tipo: "SIN_COMUNICACION"; titulo: string; detalle: string }
  | {
      tipo: "SIN_GENERACION" | "FALLA_INVERSOR";
      titulo: string;
      detalle: string;
      codigo: number | null;
      llaveDelCliente: boolean;
    };

const hora = (d: Date) =>
  d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Montevideo" });
const kw = (w: number) => `${(w / 1000).toLocaleString("es-UY", { maximumFractionDigits: 1 })} kW`;

export function diagnosticarInversor(d: UltimoDatoInversor, ahora: Date): Diagnostico {
  const edad = d.ultimoDatoEn ? (ahora.getTime() - d.ultimoDatoEn.getTime()) / 60000 : Infinity;
  if (edad > DATO_VIEJO_MIN) {
    const ultimo = d.ultimoDatoEn
      ? `Su último dato es de las ${hora(d.ultimoDatoEn)}${d.pacW != null ? `, y en ese momento generaba ${kw(d.pacW)}` : ""}.`
      : "No tiene datos.";
    return {
      tipo: "SIN_COMUNICACION",
      titulo: "Dejó de mandar datos",
      detalle: `${ultimo} Si generaba bien, lo más probable es el wifi o el datalogger, no la planta.`,
    };
  }

  const falla = d.faultCode ? describirCodigo(d.faultCode, d.faultTexto) : null;
  if (falla) {
    return {
      tipo: "FALLA_INVERSOR",
      titulo: falla.titulo,
      detalle: `El inversor informa el código ${d.faultCode}${d.statusText ? ` (${d.statusText})` : ""}. ${falla.queHacer}`,
      codigo: d.faultCode,
      llaveDelCliente: !!falla.llaveDelCliente,
    };
  }

  if ((d.pacW ?? 0) > 10) return { tipo: "GENERA" };

  const red = d.vacMax ?? 0;
  const paneles = d.vpvMax ?? 0;
  const medidas = `Red: ${Math.round(red)} V; paneles: ${Math.round(paneles)} V.`;
  if (red < 50 && paneles > 150) {
    return {
      tipo: "SIN_GENERACION",
      titulo: "El inversor no ve la red de UTE",
      detalle: `Los paneles tienen tensión pero el inversor no ve la red. ${medidas} Casi siempre es la llave de microgeneración bajada o saltada; si no, el térmico o el diferencial del inversor, o un corte de UTE.`,
      codigo: null,
      llaveDelCliente: true,
    };
  }
  if (paneles < 50) {
    return {
      tipo: "SIN_GENERACION",
      titulo: "No le llega tensión de los paneles",
      detalle: `Con sol, el inversor no ve tensión de los paneles. ${medidas} Puede ser el seccionador o los fusibles de continua, un conector suelto o un cable cortado.`,
      codigo: null,
      llaveDelCliente: false,
    };
  }
  return {
    tipo: "SIN_GENERACION",
    titulo: "No genera aunque tiene red y paneles",
    detalle: `${medidas} El inversor está ${d.statusText ? `en "${d.statusText}"` : "sin generar"}. Puede estar esperando, apagado o con la potencia limitada a cero.`,
    codigo: null,
    llaveDelCliente: false,
  };
}
