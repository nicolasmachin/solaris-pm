import { apiClient } from './axios';
import type { CategoriaPrincipal, Moneda } from '../types/finance.types';

export type ReglaTarjeta = 'VOLTIA' | 'PERSONAL' | 'MIXTA';
export type ClasificacionGasto = 'VOLTIA' | 'SOCIO' | 'ADELANTO' | 'SIN_TITULAR' | 'SIN_DECIDIR';

export interface Titular { id: string; nombre: string; regla: ReglaTarjeta; personalComo: 'CUENTA_SOCIO' | 'ADELANTO_PERSONAL' }
export interface Tarjeta { id: string; nombre: string; moneda: Moneda; activa: boolean; saldo: number; titulares: Titular[] }

export interface ResumenTarjeta {
  tarjeta: { id: string; nombre: string; moneda: Moneda };
  saldo: number;
  totales: { voltia: number; socio: number; adelantos: number; sinTitular: number; sinDecidir: number; pagos: number };
  gastos: Array<{
    id: string; fecha: string; descripcion: string; monto: number; moneda: Moneda; proveedor: string | null;
    categoria: CategoriaPrincipal; clasificacion: ClasificacionGasto;
    titular: { id: string; nombre: string; regla: ReglaTarjeta } | null; descontadoAt: string | null;
  }>;
  pagos: Array<{ id: string; fecha: string; descripcion: string; monto: number }>;
}

export interface Personales {
  saldoSocio: Partial<Record<Moneda, number>>;
  adelantos: Array<{
    id: string; fecha: string; descripcion: string; monto: number; moneda: Moneda;
    persona: string | null; tarjeta: string | null; autorizadoPor: string | null; descontadoAt: string | null;
  }>;
}

export const getTarjetas = () => apiClient.get<{ tarjetas: Tarjeta[] }>('/api/finance/tarjetas').then(r => r.data.tarjetas);

export const crearTitular = (accountId: string, body: { nombre: string; regla: ReglaTarjeta; personalComo: Titular['personalComo'] }) =>
  apiClient.post(`/api/finance/tarjetas/${accountId}/titulares`, body).then(r => r.data);

export const editarTitular = (id: string, body: Partial<{ nombre: string; regla: ReglaTarjeta; personalComo: Titular['personalComo']; activo: boolean }>) =>
  apiClient.patch(`/api/finance/tarjetas/titulares/${id}`, body).then(r => r.data);

export const getResumenTarjeta = (accountId: string, anio: number, mes: number) =>
  apiClient.get<ResumenTarjeta>(`/api/finance/tarjetas/${accountId}/resumen`, { params: { anio, mes } }).then(r => r.data);

export const clasificarGastoTarjeta = (id: string, body: { titularId?: string | null; clasificacion?: 'VOLTIA' | 'PERSONAL'; autorizadoPor?: string }) =>
  apiClient.patch(`/api/finance/tarjetas/movimientos/${id}`, body).then(r => r.data);

export const getPersonales = () => apiClient.get<Personales>('/api/finance/personales').then(r => r.data);

export const marcarDescontado = (id: string, descontado: boolean) =>
  apiClient.post(`/api/finance/personales/${id}/descontado`, { descontado }).then(r => r.data);
