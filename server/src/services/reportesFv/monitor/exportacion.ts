// ¿Esta planta genera pero no inyecta a la red?
//
// Lógica pura, sin I/O. Detecta el caso que mirar sólo la generación no puede
// ver: una planta que produce con normalidad pero cuya exportación quedó en
// cero, señal de que la **inyección está limitada en el inversor**. Desde afuera
// se ve como una planta sana —genera todos los días— mientras el cliente pierde
// el excedente que debería acreditársele.
//
// Un día suelto sin exportar no prueba nada: puede ser un día de mucho consumo
// en la casa, donde se autoconsumió todo. **Dos días seguidos generando bien y
// sin inyectar ya es un patrón.**

import { sumarDias, type Dia } from "./dias.js";

export interface UmbralesExportacion {
  /** Generación mínima del día para que la falta de exportación signifique algo. */
  generacionMinimaKwh: number;
  /** Exportación por debajo de la cual se considera que no inyectó. */
  exportacionMaximaKwh: number;
  /** Días seguidos con el patrón para que amerite alerta. */
  diasSeguidos: number;
}

export const UMBRALES_EXPORTACION: UmbralesExportacion = {
  // Un día que generó menos que esto probablemente se autoconsumió todo.
  generacionMinimaKwh: 5,
  exportacionMaximaKwh: 0.5,
  diasSeguidos: 2,
};

export function leerUmbralesExportacion(env: NodeJS.ProcessEnv = process.env): UmbralesExportacion {
  const num = (clave: string, def: number): number => {
    const raw = env[clave];
    // La cadena vacía es "no configurado", no cero: docker-compose pasa "" cuando
    // el compose declara ${VAR:-} y el .env no define VAR.
    if (raw == null || String(raw).trim() === "") return def;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : def;
  };
  return {
    generacionMinimaKwh: num("FV_MONITOR_EXPORT_GEN_MIN", UMBRALES_EXPORTACION.generacionMinimaKwh),
    exportacionMaximaKwh: num("FV_MONITOR_EXPORT_MAX", UMBRALES_EXPORTACION.exportacionMaximaKwh),
    diasSeguidos: Math.max(1, num("FV_MONITOR_EXPORT_DIAS", UMBRALES_EXPORTACION.diasSeguidos)),
  };
}

export interface DiaExportacion {
  generacionKwh: number | null;
  /** null = el medidor no reportó ese día. NO es lo mismo que cero. */
  exportacionKwh: number | null;
}

export interface EntradaExportacion {
  /** Día evaluado. */
  dia: Dia;
  /** Últimos días, incluido el evaluado. */
  historial: Map<Dia, DiaExportacion>;
  umbrales: UmbralesExportacion;
}

export interface VeredictoExportacion {
  alerta: boolean;
  /** Días seguidos generando bien sin inyectar, terminando en el día evaluado. */
  diasSinExportar: number;
  detalle: string | null;
}

/**
 * La distinción que sostiene todo esto: **exportó cero** no es lo mismo que **no
 * sabemos cuánto exportó**. El primero es un problema del cliente que cuesta
 * plata todos los días; el segundo es un medidor que no reportó, molesto pero
 * inocuo. Un día sin dato **corta la racha** en vez de sumarla: preferimos no
 * avisar antes que avisar mal, porque el smart meter falla seguido y un panel
 * lleno de alertas falsas deja de mirarse en dos semanas.
 */
export function evaluarExportacion(e: EntradaExportacion): VeredictoExportacion {
  const u = e.umbrales;
  let dias = 0;
  let cursor = e.dia;
  let generacionAcumulada = 0;

  for (let i = 0; i < 31; i++) {
    const d = e.historial.get(cursor);
    // Sin dato del día (ni de generación ni del medidor) no se puede afirmar nada.
    if (!d || d.generacionKwh == null || d.exportacionKwh == null) break;
    // Un día flojo no cuenta ni a favor ni en contra: corta la racha.
    if (d.generacionKwh < u.generacionMinimaKwh) break;
    // Inyectó: no hay patrón.
    if (d.exportacionKwh > u.exportacionMaximaKwh) break;

    dias++;
    generacionAcumulada += d.generacionKwh;
    cursor = sumarDias(cursor, -1);
  }

  if (dias < u.diasSeguidos) return { alerta: false, diasSinExportar: dias, detalle: null };

  return {
    alerta: true,
    diasSinExportar: dias,
    detalle:
      `Generó ${Math.round(generacionAcumulada)} kWh en los últimos ${dias} días y no inyectó ` +
      `nada a la red. Suele ser la inyección limitada en el inversor: el cliente está ` +
      `produciendo energía que no se le acredita.`,
  };
}
