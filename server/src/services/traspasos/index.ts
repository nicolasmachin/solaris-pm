import { startTraspasosEscalacionJob } from "./escalacion.service.js";
import { startTraspasosReportesJobs } from "./reportes.service.js";

// Arranca los jobs cron del módulo Traspasos: escalación por SLA + reportes ADMIN.
export function startTraspasosJobs() {
  startTraspasosEscalacionJob();
  startTraspasosReportesJobs();
}

export { crearTraspaso, crearTraspasoSiNoExiste, confirmarTraspaso, cancelarTraspaso } from "./traspasos.service.js";
export { calcularDestinatarios, previewDestinatarios } from "./destinatarios.js";
export { STAGE_TO_TRASPASO, STAGE_TO_TRASPASO_EXTRA, buildModalTexto, TRASPASO_LABEL } from "./catalogo.js";
