import { apiClient } from "./axios";

export type IngenieriaEstado = "Sin etapa" | "Sin iniciar" | "En proceso" | "Completada";

export interface IngenieriaDashboardProject {
  projectId: string;
  projectCode: string;
  cliente: string;
  ubicacion: string;
  potenciaKwp: number;
  subetapasCompletas: number;
  subetapasTotales: number;
  progressPercent: number;
  stageStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | null;
  estado: IngenieriaEstado;
  actualStartDate: string | null;
  actualEndDate: string | null;
  plannedEndDate: string | null;
}

export interface IngenieriaDashboard {
  stats: { enCola: number; enProceso: number; completadas30d: number };
  projects: IngenieriaDashboardProject[];
}

export interface IngenieriaToolCard {
  key: string;
  nombre: string;
  icono: string;
  estado: string;
  disponible: boolean;
  ruta: string | null;
}

export interface IngenieriaWorkspaceDocument {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  tipo: string | null;
  toolSource: string | null;
  toolVersion: number | null;
  toolEntityId: string | null;
  createdAt: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface IngenieriaWorkspace {
  project: {
    id: string;
    code: string;
    cliente: string;
    ubicacion: string;
    potenciaKwp: number;
    status: string;
  };
  etapa: {
    stageId: string | null;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | null;
    progressPercent: number;
    subetapasCompletas: number;
    subetapasTotales: number;
    estado: IngenieriaEstado;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
    responsibleUserId: string | null;
  };
  herramientas: IngenieriaToolCard[];
  documentos: IngenieriaWorkspaceDocument[];
}

export async function getIngenieriaDashboard(): Promise<IngenieriaDashboard> {
  const { data } = await apiClient.get<IngenieriaDashboard>("/api/ingenieria/dashboard");
  return data;
}

export async function getIngenieriaWorkspace(projectId: string): Promise<IngenieriaWorkspace> {
  const { data } = await apiClient.get<IngenieriaWorkspace>(
    `/api/ingenieria/proyecto/${projectId}`,
  );
  return data;
}
