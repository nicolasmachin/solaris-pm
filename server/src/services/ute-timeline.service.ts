/**
 * El timeline del trámite UTE: los diez hitos, con su fecha si ya pasaron.
 *
 * Vive acá y no dentro de las rutas del portal porque **lo ven dos públicos**: el
 * cliente en su portal y Experiencia Solar en la ficha. Que fueran dos armados
 * distintos garantizaba que tarde o temprano dijeran cosas distintas del mismo
 * trámite, y entonces el equipo no podría responder por lo que el cliente ve.
 */

import { serializeDate } from "../utils/serialization.js";



export type UteStageKey =
  | "consulta"
  | "caso_abierto"
  | "consulta_aprobada"
  | "solicitud"
  | "proyecto_aprobado"
  | "docs1"
  | "docs1_aprobados"
  | "ensayos"
  | "ensayos_aprobados"
  | "docs2"
  | "finalizado";

export type UteTimelineItem = {
  key: UteStageKey;
  label: string;
  description: string;
  responsible: "VOLTIA" | "UTE";
  status: "completed" | "current" | "pending";
  completedAt: string | null;
  daysInStage: number | null;
  explanation: string | null;
};

export function buildUteTimeline(
  ute: {
    consultaSentAt: Date | null;
    caseOpenedAt: Date | null;
    consultaApprovedAt: Date | null;
    solicitudSentAt: Date | null;
    proyectoApprovedAt: Date | null;
    docs1SentAt: Date | null;
    docs1ApprovedAt: Date | null;
    ensayosSentAt: Date | null;
    ensayosApprovedAt: Date | null;
    docs2SentAt: Date | null;
    finalizedAt: Date | null;
  } | null,
): UteTimelineItem[] {
  const steps: Array<{
    key: UteStageKey;
    label: string;
    description: string;
    responsible: "VOLTIA" | "UTE";
    explanation: string;
    field: keyof NonNullable<typeof ute>;
  }> = [
    {
      key: "consulta",
      label: "Consulta enviada a UTE",
      description: "Voltia presenta la consulta inicial.",
      responsible: "VOLTIA",
      explanation: "Voltia envió la consulta a UTE.",
      field: "consultaSentAt",
    },
    {
      key: "caso_abierto",
      label: "Caso abierto en UTE",
      description: "UTE registra el caso en su sistema interno.",
      responsible: "UTE",
      explanation: "UTE recibió la consulta y le asignó un número de caso.",
      field: "caseOpenedAt",
    },
    {
      key: "consulta_aprobada",
      label: "Consulta aprobada",
      description: "UTE da el visto bueno técnico inicial.",
      responsible: "UTE",
      explanation: "UTE aprobó la consulta inicial. Voltia ya puede preparar la solicitud formal.",
      field: "consultaApprovedAt",
    },
    {
      key: "solicitud",
      label: "Solicitud enviada",
      description: "Voltia presenta la solicitud formal.",
      responsible: "VOLTIA",
      explanation: "Voltia envió la solicitud formal a UTE.",
      field: "solicitudSentAt",
    },
    {
      key: "proyecto_aprobado",
      label: "Proyecto aprobado",
      description: "UTE aprueba el proyecto técnico.",
      responsible: "UTE",
      explanation: "UTE aprobó el proyecto. Voltia puede preparar la documentación de obra.",
      field: "proyectoApprovedAt",
    },
    {
      key: "docs1",
      label: "Documentos de obra enviados",
      description: "Voltia entrega la primera tanda de documentación.",
      responsible: "VOLTIA",
      explanation: "Voltia envió a UTE la documentación de obra.",
      field: "docs1SentAt",
    },
    {
      key: "docs1_aprobados",
      label: "Documentos de obra aprobados",
      description: "UTE aprueba la documentación de obra.",
      responsible: "UTE",
      explanation: "UTE aprobó la documentación. Voltia coordina ensayos.",
      field: "docs1ApprovedAt",
    },
    {
      key: "ensayos",
      label: "Ensayos enviados",
      description: "Voltia envía resultados de ensayos.",
      responsible: "VOLTIA",
      explanation: "Voltia envió los resultados de los ensayos a UTE.",
      field: "ensayosSentAt",
    },
    {
      key: "ensayos_aprobados",
      label: "Ensayos aprobados",
      description: "UTE valida los ensayos.",
      responsible: "UTE",
      explanation: "UTE aprobó los ensayos. Voltia prepara documentación final.",
      field: "ensayosApprovedAt",
    },
    {
      key: "docs2",
      label: "Documentos finales enviados",
      description: "Voltia presenta la documentación final.",
      responsible: "VOLTIA",
      explanation: "Voltia envió la documentación final a UTE.",
      field: "docs2SentAt",
    },
    {
      key: "finalizado",
      label: "Trámite finalizado",
      description: "UTE habilita el sistema.",
      responsible: "UTE",
      explanation: "¡Trámite UTE finalizado! El sistema queda habilitado.",
      field: "finalizedAt",
    },
  ];

  if (!ute) {
    return steps.map((s) => ({
      key: s.key,
      label: s.label,
      description: s.description,
      responsible: s.responsible,
      status: "pending",
      completedAt: null,
      daysInStage: null,
      explanation: null,
    }));
  }

  // Última fecha disponible (para calcular daysInStage de la etapa actual).
  const dates = steps
    .map((s) => ({ key: s.key, date: ute[s.field] as Date | null }))
    .filter((s): s is { key: UteStageKey; date: Date } => s.date != null);
  const lastCompletedDate = dates.length > 0 ? dates[dates.length - 1].date : null;

  // currentIndex = primer paso pendiente.
  let currentIndex = -1;
  for (let i = 0; i < steps.length; i++) {
    if (ute[steps[i].field] == null) {
      currentIndex = i;
      break;
    }
  }
  // Si todos completados, no hay current.
  const allDone = currentIndex === -1;

  const now = new Date();
  return steps.map((s, i) => {
    const completedAt = ute[s.field] as Date | null;
    if (completedAt) {
      return {
        key: s.key,
        label: s.label,
        description: s.description,
        responsible: s.responsible,
        status: "completed" as const,
        completedAt: serializeDate(completedAt),
        daysInStage: null,
        explanation: null,
      };
    }
    if (!allDone && i === currentIndex) {
      const daysInStage = lastCompletedDate
        ? Math.max(0, Math.round((now.getTime() - lastCompletedDate.getTime()) / 86_400_000))
        : null;
      return {
        key: s.key,
        label: s.label,
        description: s.description,
        responsible: s.responsible,
        status: "current" as const,
        completedAt: null,
        daysInStage,
        explanation: s.explanation,
      };
    }
    return {
      key: s.key,
      label: s.label,
      description: s.description,
      responsible: s.responsible,
      status: "pending" as const,
      completedAt: null,
      daysInStage: null,
      explanation: null,
    };
  });
}