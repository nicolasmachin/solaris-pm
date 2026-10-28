// Lógica pura del vigía de Soporte: qué le pasa a una planta según su última
// lectura de Growatt y la de toda la cartera. Sin base ni API, para testearla.
//
// La idea central: el clima afecta a todas las plantas a la vez. Si la mediana
// de la cartera está generando, hay sol; una planta que en ese momento no
// genera (o está desconectada) tiene un problema propio. Y cada planta tiene su
// "factor normal" respecto de la mediana (orientación, sombras, inclinación):
// compararla contra sí misma evita las falsas alarmas de las plantas que por
// su techo siempre rinden menos.

/** Mediana de la cartera (W por Wp) a partir de la cual se considera que hay sol. */
export const SOL_MIN = 0.1;
/** Mediana mínima para aprender el factor normal (con poco sol el cociente es ruido). */
export const SOL_APRENDER = 0.15;
/** Por debajo de esto, la planta "no genera". */
export const POTENCIA_MIN_W = 10;
/** Sondeos seguidos (de 15 min) antes de abrir un caso: una hora. */
export const SONDEOS_PARA_ALERTA = 4;
/** Peso de cada lectura nueva en el factor normal (aprende en unos días de sol). */
const ALFA = 0.03;

export const STATUS_EN_LINEA = 1;
export const STATUS_DESCONECTADA = 4;

export type LecturaPlanta = {
  status: number | null;
  potenciaW: number | null;
  kwp: number | null;
};

export type EstadoPrevio = {
  factorNormal: number | null;
  ceroConSol: number;
  desconectadaConSol: number;
};

/** W por Wp de una lectura (null si no se puede calcular). */
export function rendimiento(l: LecturaPlanta): number | null {
  if (!l.kwp || l.kwp <= 0 || l.potenciaW == null) return null;
  return Math.max(0, l.potenciaW) / (l.kwp * 1000);
}

/** Mediana de W/Wp de las plantas en línea y con datos. */
export function medianaCartera(lecturas: LecturaPlanta[]): number | null {
  const vals = lecturas
    .filter((l) => l.status === STATUS_EN_LINEA)
    .map(rendimiento)
    .filter((v): v is number => v != null && v < 1.5)
    .sort((a, b) => a - b);
  if (vals.length < 5) return null;
  const m = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
}

export type Evaluacion = {
  factorNormal: number | null;
  ceroConSol: number;
  desconectadaConSol: number;
  genera: boolean;
  haySol: boolean;
  /** Lo que habría que tener abierto según esta lectura. */
  alerta: "SIN_GENERACION" | "SIN_COMUNICACION" | null;
  /** Rinde ahora respecto de lo normal para ella (1 = normal). null si no se sabe. */
  vsNormal: number | null;
};

export function evaluarLectura(
  previo: EstadoPrevio,
  l: LecturaPlanta,
  mediana: number | null,
  opts: { aprender: boolean } = { aprender: true },
): Evaluacion {
  const haySol = mediana != null && mediana >= SOL_MIN;
  const enLinea = l.status === STATUS_EN_LINEA;
  const desconectada = l.status === STATUS_DESCONECTADA;
  const genera = enLinea && (l.potenciaW ?? 0) > POTENCIA_MIN_W;

  const ceroConSol = genera ? 0 : enLinea && haySol ? previo.ceroConSol + 1 : enLinea ? previo.ceroConSol : 0;
  const desconectadaConSol = desconectada ? (haySol ? previo.desconectadaConSol + 1 : previo.desconectadaConSol) : 0;

  const r = rendimiento(l);
  const ratio = genera && r != null && mediana ? r / mediana : null;
  let factorNormal = previo.factorNormal;
  if (opts.aprender && ratio != null && mediana! >= SOL_APRENDER && ratio < 3) {
    factorNormal = factorNormal == null ? ratio : factorNormal * (1 - ALFA) + ratio * ALFA;
  }
  const vsNormal = ratio != null && factorNormal ? ratio / factorNormal : genera ? null : haySol && enLinea ? 0 : null;

  let alerta: Evaluacion["alerta"] = null;
  if (ceroConSol >= SONDEOS_PARA_ALERTA) alerta = "SIN_GENERACION";
  else if (desconectadaConSol >= SONDEOS_PARA_ALERTA) alerta = "SIN_COMUNICACION";

  return { factorNormal, ceroConSol, desconectadaConSol, genera, haySol: haySol, alerta, vsNormal };
}
