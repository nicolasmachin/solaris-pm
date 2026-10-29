import { apiClient } from './axios';

import type { Moneda, TipoMovimiento } from '../types/finance.types';

// Conciliación diaria contra el banco: lo que leyó el robot de eBROU y no tiene
// pareja en Voltia PM (misma cuenta, mismo sentido, monto dentro del margen y
// fecha a no más de 3 días).

/** Lo más parecido en Voltia PM a un movimiento del banco que falta cargar. */
export interface SugerenciaBanco {
  clave: string;
  tipo: 'MOVIMIENTO' | 'DEUDA' | 'DEUDA_PROVEEDOR' | 'COSTO_FIJO' | 'COBRO' | 'FACTURA';
  refId: string;
  titulo: string;
  detalle: string | null;
  monto: number;
  moneda: 'USD' | 'UYU';
  fecha: string | null;
  puntaje: number;
  motivos: string[];
  accion: string;
}

export interface SugerenciaIa {
  opcion: SugerenciaBanco | null;
  queEs: string;
  confianza: 'alta' | 'media' | 'baja';
  at: string;
}

export interface PendienteBanco {
  id: string;
  fecha: string;
  descripcion: string;
  documento: string | null;
  /** El detalle del home banking: a quién se le pagó / quién transfirió y el concepto. */
  asunto?: string | null;
  tipo: TipoMovimiento;
  monto: number;
  sugerencias?: SugerenciaBanco[];
  sugerenciaIa?: SugerenciaIa | null;
  cargoBancario?: boolean;
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

export const resolverBanco = (id: string, clave: string) =>
  apiClient.post<{ ok: true; hecho: string }>(`/api/finance/banco/movimientos/${id}/resolver`, { clave }).then(r => r.data);

export const cargarCargosBancarios = (ids: string[]) =>
  apiClient.post<{ ok: true; cargados: number }>('/api/finance/banco/cargos-bancarios', { ids }).then(r => r.data);

export const interpretarBancoConIa = (accountId?: string) =>
  apiClient.post<{ ok: true; interpretados: number; revisados: number }>('/api/finance/banco/interpretar', accountId ? { accountId } : {}).then(r => r.data);

export const marcarNoVaBanco = (id: string, motivo: string) =>
  apiClient.post<{ ok: true }>(`/api/finance/banco/movimientos/${id}/no-va`, { motivo }).then(r => r.data);

// ─── Registro: todo lo leído del banco, con su estado y su pareja ───────────

export type EstadoBanco = 'CONFIRMADA' | 'COINCIDE' | 'FALTA_CARGAR' | 'NO_VA' | 'NO_SE_COMPARA';

export interface ParejaPm {
  id: string;
  tipo: 'MOVIMIENTO' | 'PAGO';
  fecha: string;
  descripcion: string;
  monto: number;
}

export interface MovimientoBancoRegistro extends PendienteBanco {
  accountId: string;
  cuenta: string;
  moneda: Moneda;
  dependencia: string | null;
  estado: EstadoBanco;
  pareja: ParejaPm | null;
  noVaMotivo: string | null;
  noVaPor: string | null;
}

export const getRegistroBanco = (params: { accountId?: string; desde?: string; hasta?: string }) =>
  apiClient.get<{ movimientos: MovimientoBancoRegistro[] }>('/api/finance/banco/movimientos', { params }).then(r => r.data.movimientos);

export const deshacerNoVaBanco = (id: string) =>
  apiClient.post<{ ok: true }>(`/api/finance/banco/movimientos/${id}/deshacer-no-va`).then(r => r.data);

export const vincularBanco = (id: string, destino: { movementId?: string; paymentId?: string }) =>
  apiClient.post<{ ok: true }>(`/api/finance/banco/movimientos/${id}/vincular`, destino).then(r => r.data);

export const desvincularBanco = (id: string) =>
  apiClient.post<{ ok: true }>(`/api/finance/banco/movimientos/${id}/desvincular`).then(r => r.data);

// ─── "Por conciliar" (Inicio de Finanzas) ──────────────────────────────────

export interface PorConciliar {
  banco: Array<{ accountId: string; nombre: string; moneda: Moneda; faltaCargar: number; bancoLeidoEn: string | null }>;
  sinBanco: Array<ParejaPm & { accountId: string; cuenta: string; moneda: Moneda; sentido: TipoMovimiento }>;
  facturas: { total: number; sinProveedor: number; atrasadas: number };
  duplicados: Array<{
    proveedor: string; moneda: Moneda; monto: number;
    a: { id: string; fecha: string | null; descripcion: string; invoiceNumber: string | null };
    b: { id: string; fecha: string | null; descripcion: string; invoiceNumber: string | null };
  }>;
}

export const getPorConciliar = () =>
  apiClient.get<PorConciliar>('/api/finance/por-conciliar').then(r => r.data);

// ─── "Para hacer hoy" (Inicio de Finanzas y número del menú) ────────────────

export interface ItemHoy {
  clave: string; grupo: string; texto: string; cantidad: number; link: string;
  gravedad: 'VENCIDO' | 'HOY' | 'AVISO';
}

export const getParaHacerHoy = () =>
  apiClient.get<{ items: ItemHoy[] }>('/api/finance/para-hacer-hoy').then(r => r.data.items);

export const getTotalParaHacerHoy = () =>
  apiClient.get<{ total: number; vencidos: number }>('/api/finance/para-hacer-hoy/total').then(r => r.data);
