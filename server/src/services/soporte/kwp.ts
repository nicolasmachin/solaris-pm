// La potencia instalada de una planta, de la fuente más confiable.
//
// En el proyecto hay valores mal cargados (medido el 28-oct-2026: Hotel Lamas 2
// en 0,01 kWp y Lamas 1 con 45,6, el total del hotel; Barenof en 0). La de la
// configuración de reportes FV la cargó una persona mirando la planta, así que
// va primero; después la del proyecto y la de Growatt, si son razonables.

const MIN_KWP = 0.5;

const valido = (v: unknown): number | null => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) && n >= MIN_KWP ? n : null;
};

export function kwpEfectivo(fuentes: { config?: unknown; proyecto?: unknown; growatt?: unknown }): number | null {
  return valido(fuentes.config) ?? valido(fuentes.proyecto) ?? valido(fuentes.growatt);
}
