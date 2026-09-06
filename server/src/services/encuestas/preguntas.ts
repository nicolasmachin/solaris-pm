/**
 * Las preguntas de cada encuesta de satisfacción.
 *
 * Son tres encuestas distintas, no una repetida: cada una mide una etapa del
 * recorrido y por eso pregunta cosas distintas. El criterio de diseño:
 *
 *   - Pregunta 1 → el RESULTADO (conformidad general con Voltia)
 *   - Pregunta 2 → NUESTRO TRABAJO de acompañamiento (claridad, seguimiento,
 *     recomendación). Es la serie que se puede seguir en el tiempo para saber si
 *     el área mejora, porque está en las tres.
 *   - Pregunta 3 → lo ESPECÍFICO de esa etapa.
 *
 * Todas en escala 1-5. Solo la primera es obligatoria: sumar fricción con una
 * tasa de respuesta del ~5% sería contraproducente.
 */

import { SurveyTipo } from "@prisma/client";

export type PreguntasEncuesta = {
  intro: string;
  pregunta1: string;
  pregunta2: string;
  pregunta3: string;
  comentario: string;
};

export const PREGUNTAS_POR_TIPO: Record<SurveyTipo, PreguntasEncuesta> = {
  [SurveyTipo.OBRA]: {
    intro: "Ya está instalado tu sistema. Contanos cómo viviste el proceso hasta acá.",
    pregunta1: "¿Qué tan conforme estás con Voltia hasta acá?",
    pregunta2: "¿Qué tan claro y bien informado sentiste el proceso desde que compraste?",
    pregunta3: "¿Qué tan conforme quedaste con el trabajo del equipo el día de la instalación?",
    comentario: "¿Hay algo que podríamos haber hecho mejor?",
  },
  [SurveyTipo.HABILITACION]: {
    intro: "Ahora que ya estás generando, contanos cómo viviste la espera de la habilitación.",
    pregunta1: "¿Qué tan conforme quedaste con la experiencia general?",
    pregunta2: "¿Qué tan acompañado e informado te sentiste durante la espera de la habilitación?",
    pregunta3: "¿Qué tan claro te resultó el momento de encender el sistema?",
    comentario: "¿Hay algo de esa etapa que podríamos haber manejado mejor?",
  },
  [SurveyTipo.ANIVERSARIO]: {
    intro: "Pasó un año con tu sistema funcionando. Nos interesa saber cómo viene la experiencia.",
    pregunta1: "¿Qué tan conforme estás con tu sistema y con Voltia en este año?",
    pregunta2: "¿Qué tan probable es que nos recomiendes a alguien?",
    pregunta3: "¿Qué tan conforme estás con la respuesta que recibiste cuando necesitaste algo?",
    comentario: "¿Hay algo en lo que podamos ayudarte o mejorar?",
  },
};

/**
 * Promedio de las notas respondidas, redondeado a un decimal. Es el puntaje de
 * la encuesta. Ignora las que quedaron sin responder (2 y 3 son opcionales), así
 * que una encuesta con una sola nota promedia esa nota.
 */
export function promedioNotas(notas: Array<number | null | undefined>): number | null {
  const vals = notas.filter((n): n is number => typeof n === "number");
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/**
 * Una encuesta es "nota baja" si CUALQUIERA de sus notas individuales está en el
 * umbral o por debajo, **o** si el promedio lo está. Los dos criterios suman: un
 * cliente conforme en general pero disconforme con la comunicación tiene que
 * disparar el aviso igual.
 */
export function esNotaBaja(notas: Array<number | null | undefined>, umbral: number): boolean {
  const vals = notas.filter((n): n is number => typeof n === "number");
  if (vals.length === 0) return false;
  if (vals.some((n) => n <= umbral)) return true;
  const prom = promedioNotas(vals);
  return prom !== null && prom <= umbral;
}
