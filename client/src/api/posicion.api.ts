import { apiClient } from './axios';

export type TramosPosicion = {
  VENCIDO: number; HASTA_7: number; HASTA_30: number; MAS_30: number; SIN_FECHA: number; total: number;
};

export interface PosicionDto {
  hoy: string;
  usdToUyu: number;
  caja: { USD: number; UYU: number; totalUsd: number };
  nosDeben: TramosPosicion & { obrasSinPlanCompleto: number };
  debemos: TramosPosicion & {
    desglose: { proveedores: TramosPosicion; otrosCompromisos: TramosPosicion; comisiones: TramosPosicion; instaladores: TramosPosicion };
    saldoAFavorProveedores: number;
  };
  neto: number;
  netoConCaja: number;
}

export const getPosicion = () => apiClient.get<PosicionDto>('/api/finance/posicion').then((r) => r.data);
