// ¿El medidor de esta planta está midiendo al revés?
//
// Lógica pura, sin I/O. Detecta el caso que pasó en Estilo (julio) y en Rodolfo
// Sosa (octubre): el smart meter con los transformadores de corriente dados
// vuelta. De noche cuenta lo que la casa compra como exportación y de día lo
// que se exporta como compra. Se delata solo: **una planta no puede exportar
// más de lo que genera**, y con el medidor invertido eso pasa casi todos los días.
//
// Un día suelto no alcanza (un desfase de horario entre la serie de generación y
// la del medidor puede dar un exceso chico), así que se pide un margen y que se
// repita: dos de los últimos tres días con dato.

import { sumarDias, type Dia } from "./dias.js";

export interface UmbralesMedidor {
  /** Exceso mínimo (exportación − generación) para que el día cuente. */
  excesoMinimoKwh: number;
  /** Además, el exceso tiene que superar este porcentaje de la generación. */
  excesoMinimoPct: number;
  /** Días con exceso dentro de la ventana para que amerite alerta. */
  diasConExceso: number;
  /** Últimos días con dato que se miran. */
  ventanaDias: number;
}

export const UMBRALES_MEDIDOR: UmbralesMedidor = {
  excesoMinimoKwh: 2,
  excesoMinimoPct: 10,
  diasConExceso: 2,
  ventanaDias: 3,
};

export interface DiaMedidor {
  generacionKwh: number | null;
  /** null = el medidor no reportó ese día. */
  exportacionKwh: number | null;
}

export interface VeredictoMedidor {
  alerta: boolean;
  diasConExceso: number;
  detalle: string | null;
}

/** El día exporta más de lo que generó, con margen. */
export function exportaMasDeLoQueGenera(d: DiaMedidor, u: UmbralesMedidor = UMBRALES_MEDIDOR): boolean {
  if (d.generacionKwh == null || d.exportacionKwh == null) return false;
  const exceso = d.exportacionKwh - d.generacionKwh;
  return exceso >= u.excesoMinimoKwh && exceso >= (d.generacionKwh * u.excesoMinimoPct) / 100;
}

export function evaluarMedidor(e: {
  dia: Dia;
  historial: Map<Dia, DiaMedidor>;
  umbrales?: UmbralesMedidor;
}): VeredictoMedidor {
  const u = e.umbrales ?? UMBRALES_MEDIDOR;
  const conExceso: Array<{ dia: Dia; gen: number; exp: number }> = [];
  let mirados = 0;
  let cursor = e.dia;

  // Se buscan los últimos `ventanaDias` días CON dato del medidor, mirando hasta
  // dos semanas atrás: un día sin dato no corta (a diferencia de "no exporta",
  // acá no hay racha que cuidar).
  for (let i = 0; i < 14 && mirados < u.ventanaDias; i++) {
    const d = e.historial.get(cursor);
    if (d && d.generacionKwh != null && d.exportacionKwh != null) {
      mirados++;
      if (exportaMasDeLoQueGenera(d, u)) {
        conExceso.push({ dia: cursor, gen: d.generacionKwh, exp: d.exportacionKwh });
      }
    }
    cursor = sumarDias(cursor, -1);
  }

  // El día evaluado tiene que ser uno de los malos: si hoy ya mide bien (se
  // corrigió), la incidencia se cierra sola.
  const hoyMal = conExceso.some((c) => c.dia === e.dia);
  if (!hoyMal || conExceso.length < u.diasConExceso) {
    return { alerta: false, diasConExceso: conExceso.length, detalle: null };
  }

  const ejemplo = conExceso[0];
  return {
    alerta: true,
    diasConExceso: conExceso.length,
    detalle:
      `Exportó más de lo que generó en ${conExceso.length} de los últimos ${mirados} días ` +
      `(el ${ejemplo.dia.slice(8, 10)}/${ejemplo.dia.slice(5, 7)}: generó ${Math.round(ejemplo.gen)} kWh ` +
      `y figura exportando ${Math.round(ejemplo.exp)}). Es imposible: el medidor está midiendo al ` +
      `revés o mal conectado (transformadores de corriente dados vuelta o en otra fase). ` +
      `Los reportes al cliente salen mal hasta que se corrija.`,
  };
}
