/**
 * Cuándo un cliente está fuera de su cadencia de contacto.
 *
 * Un solo criterio para todas las pantallas: el listado y el Recorrido de
 * Experiencia Solar, el resumen diario, el panel de Operaciones y el conector.
 * Antes Operaciones y Experiencia Solar calculaban "sin comunicación" cada uno a
 * su manera (con otro universo de clientes y otra etapa para los importados) y el
 * mismo cliente daba distinto según dónde se mirara.
 *
 * La tolerancia existe porque el aviso de "le toca contacto" llega el día en que
 * se cumple el plazo, y contactarlo ese día está bien: no tiene sentido que figure
 * fuera de cadencia mientras se lo está contactando. Con cadencia de 5 días
 * hábiles y tolerancia de 1: hasta el día 5 está al día, el día 6 "toca hoy" y
 * recién el día 7 cuenta como fuera de cadencia.
 */

/** Días hábiles de tolerancia después de cumplida la cadencia. */
export const TOLERANCIA_CADENCIA_DIAS = (() => {
  const n = Number(process.env.CADENCIA_TOLERANCIA_DIAS ?? 1);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
})();

export type EstadoCadencia = "sin_cadencia" | "al_dia" | "toca_hoy" | "fuera";

/**
 * @param diasSinContacto días hábiles desde el último contacto; null = nunca hubo.
 * @param objetivo días hábiles de la cadencia del recorrido; null = sin cadencia.
 */
export function estadoCadencia(diasSinContacto: number | null, objetivo: number | null): EstadoCadencia {
  if (objetivo == null) return "sin_cadencia";
  // Sin ningún contacto registrado no hay de dónde contar: siempre falta.
  if (diasSinContacto === null) return "fuera";
  if (diasSinContacto <= objetivo) return "al_dia";
  if (diasSinContacto <= objetivo + TOLERANCIA_CADENCIA_DIAS) return "toca_hoy";
  return "fuera";
}
