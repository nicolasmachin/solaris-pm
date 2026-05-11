// Shape de entrada del template del PDF v2 del Proyecto Final de Ingeniería.
// Construido por dataLoader.ts a partir de los snapshots de EFPVersion (Fase A).
// El template (template.html.ts) es función pura: este input adentro, HTML
// completo afuera. Sin estado, sin queries a DB.

import type {
  SnapshotMaterials,
  SnapshotPreIng,
  SnapshotProject,
  SnapshotUte,
} from "../../efp.snapshots.types.js";

export type EFPVersionStatus = "DRAFT" | "REVIEW" | "APPROVED" | "ARCHIVED";

export type EFPPdfInput = {
  // Identificación
  versionNumber: number;
  versionStatus: EFPVersionStatus;
  versionApprovedAt: string | null; // ISO; null si todavía no aprobado
  generatedAt: string; // ISO del momento de generación del PDF

  // Snapshots congelados (NO DB live reads)
  project: SnapshotProject;
  preIng: SnapshotPreIng | null;
  ute: SnapshotUte | null;
  materials: SnapshotMaterials | null;

  // Contenido editado: las 7 secciones en markdown
  sections: {
    datosGenerales: string;
    resumenEjecutivo: string;
    analisisSitio: string;
    equipamiento: string;
    disenoElectrico: string;
    disenoMecanico: string;
    anexos: string;
  };

  // Métricas derivadas — calculadas, no provienen de la IA
  computed: {
    potenciaTotalKwp: number | null;
    inversor: string | null;
    paneles: { cantidad: number | null; potenciaW: number | null };
  };

  // Adjuntos a listar como separadores de anexo (filtrados por includeInPdf=true)
  attachments: Array<{
    label: string; // "Anexo A", "Anexo B"…
    title: string; // descripción legible o filename
    filename: string; // nombre del archivo
    category: string | null;
  }>;
};
