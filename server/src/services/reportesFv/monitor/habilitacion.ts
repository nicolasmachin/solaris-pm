// ¿Desde cuándo está habilitada esta planta?
//
// No existe un campo `habilitadoEn` en Project: la habilitación quedó repartida
// en cuatro señales según por qué camino pasó el proyecto (traspaso T8,
// ute-sync, o carga histórica). Esta cascada es la que ya usan
// `utils/aniversario.ts` y `aviso-habilitacion.service.ts`.
//
// Importa más de lo que parece: si esto se equivoca, el monitoreo alerta por
// plantas que todavía no se encendieron. Es la fuente de falsos positivos más
// probable de toda la feature, y por eso es una función pura con tests.

export interface DatosHabilitacion {
  postHabilitacionInicioEn: Date | null;
  actualUteEnd: Date | null;
  uteProcesses: Array<{ currentStage: string | null; finalizedAt: Date | null }>;
  /** Sólo las etapas de UTE; ver ETAPAS_UTE. */
  stages: Array<{ name: string; actualEndDate: Date | null; status?: string | null }>;
}

/**
 * Los nombres viejos y nuevos del pipeline conviven en producción (v8.0 renombró
 * las etapas y no todos los proyectos se migraron). Cualquier query sobre
 * Stage.name tiene que contemplar los dos, igual que `ute-sync.service.ts`.
 */
export const ETAPAS_UTE = ["TRAMITACION_UTE", "HABILITACION_UTE"];
export const ETAPAS_POST_HABILITACION = ["POST_HABILITACION", "POSTVENTA"];

/**
 * Fecha desde la que se espera que la planta genere, o null si todavía no
 * está habilitada.
 *
 * Orden de preferencia:
 *   1. postHabilitacionInicioEn — el ancla canónica, la setea el traspaso T8.
 *   2. UteProcess.finalizedAt — el trámite se cerró.
 *   3. Stage(TRAMITACION_UTE|HABILITACION_UTE).actualEndDate.
 *   4. actualUteEnd — espejo histórico del anterior.
 *
 * Caso borde real: un trámite con currentStage="FINALIZADO" pero finalizedAt
 * null. Está habilitado igual; se cae al siguiente escalón para la fecha, y si
 * ninguno la tiene NO se inventa "hoy" (inventarla marcaría la planta como
 * recién habilitada para siempre, silenciándola).
 */
export function resolverHabilitadoEn(p: DatosHabilitacion): Date | null {
  if (p.postHabilitacionInicioEn) return p.postHabilitacionInicioEn;

  const finalizado = p.uteProcesses.find(
    (u) => u.finalizedAt != null || u.currentStage === "FINALIZADO",
  );
  if (finalizado?.finalizedAt) return finalizado.finalizedAt;

  const etapaUte = p.stages.find(
    (s) => ETAPAS_UTE.includes(s.name) && s.actualEndDate != null,
  );
  if (etapaUte?.actualEndDate) return etapaUte.actualEndDate;

  if (p.actualUteEnd) return p.actualUteEnd;

  // Trámite finalizado pero sin ninguna fecha registrada: está habilitado, y lo
  // único honesto es no decir desde cuándo. Se devuelve null y el diagnóstico lo
  // trata como "esperando habilitación" — prefiere callar antes que alertar mal.
  return null;
}

export type FuenteOperativa = "habilitacion" | "reportes";

/**
 * Desde cuándo se espera que esta planta genere.
 *
 * OJO: no es lo mismo que la habilitación de UTE, y confundirlas rompía el
 * monitoreo. Medido sobre la base real: 32 de las 44 plantas vinculadas (73%)
 * NO tienen ninguna fecha de habilitación — son clientes viejos, muchos
 * cargados como generadores livianos por CSV, que nunca pasaron por el pipeline
 * de etapas. Con sólo la cascada de UTE, el monitoreo las daba a todas por
 * "esperando habilitación" y no alertaba nunca: un falso negativo silencioso,
 * mucho peor que un falso positivo ruidoso.
 *
 * Por eso el último escalón es `ReporteFvConfig.mesInicio`: si le venimos
 * mandando el reporte mensual desde tal mes, la planta genera desde tal mes.
 * Es evidencia directa, no una inferencia.
 *
 * Sin ninguna de las dos, sigue devolviendo null y la planta queda silenciada:
 * es lo correcto para una instalación que todavía no arrancó.
 */
export function resolverOperativaDesde(p: {
  habilitadoEn: Date | null;
  /** ReporteFvConfig.mesInicio — día 1 del primer mes reportado. */
  mesInicioReportes: Date | null;
}): { desde: Date | null; fuente: FuenteOperativa | null } {
  if (p.habilitadoEn) return { desde: p.habilitadoEn, fuente: "habilitacion" };
  if (p.mesInicioReportes) return { desde: p.mesInicioReportes, fuente: "reportes" };
  return { desde: null, fuente: null };
}
