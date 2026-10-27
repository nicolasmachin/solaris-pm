import { apiClient } from "./axios";

export interface FilaGastoIA {
  mes: string; // "2026-10"
  feature: string;
  featureLabel: string;
  provider: string;
  model: string;
  llamadas: number;
  errores: number;
  sinPrecio: number;
  costUsd: number;
  tokensInput: number;
  tokensOutput: number;
  audioSegundos: number;
}

export interface FilaGastoUsuario {
  mes: string;
  userId: string;
  nombre: string;
  llamadas: number;
  costUsd: number;
  /** Parte del costo que es del asistente del equipo. */
  asistenteUsd: number;
}

export interface GastoIAResponse {
  desde: string;
  primerRegistro: string | null;
  filas: FilaGastoIA[];
  porUsuario: FilaGastoUsuario[];
}

export const getGastoIA = (meses = 6) =>
  apiClient.get<GastoIAResponse>("/api/ai/usage", { params: { meses } }).then((r) => r.data);
