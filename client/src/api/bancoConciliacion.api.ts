import { apiClient } from './axios';

import type { Moneda, TipoMovimiento } from '../types/finance.types';

// Conciliación diaria contra el banco: lo que leyó el robot de eBROU y no tiene
// pareja en Voltia PM (misma cuenta, mismo sentido, monto dentro del margen y
// fecha a no más de 3 días).

export interface PendienteBanco {
  id: string;
  fecha: string;
  descripcion: string;
  documento: string | null;
  tipo: TipoMovimiento;
  monto: number;
}

export interface CuentaConciliada {
  accountId: string;
  nombre: string;
  moneda: Moneda;
  numeroCuentaBanco: string;
  bancoLeidoEn: string | null;
  bancoSaldo: number | null;
  margen: number;
  conciliados: number;
  pendientes: PendienteBanco[];
}

export const getPendientesBanco = () =>
  apiClient.get<{ cuentas: CuentaConciliada[] }>('/api/finance/banco/pendientes').then(r => r.data.cuentas);

export const marcarNoVaBanco = (id: string, motivo: string) =>
  apiClient.post<{ ok: true }>(`/api/finance/banco/movimientos/${id}/no-va`, { motivo }).then(r => r.data);
