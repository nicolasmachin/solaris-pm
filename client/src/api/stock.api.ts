import { apiClient } from './axios';
import type { Moneda, StockMovement, StockProduct, TipoMovimientoStock } from '../types/finance.types';
import type { PaginatedResponse } from '../types/api.types';

// ─── Products ─────────────────────────────────────────────────────────────────

export const getStockProducts = (params?: { categoria?: string; activo?: boolean }) =>
  apiClient.get<StockProduct[]>('/api/stock/products', { params }).then(r => r.data);

export const createStockProduct = (body: {
  nombre: string;
  descripcion?: string;
  categoria: string;
  unidad?: string;
  stockMinimo?: number;
  costoPromedio?: number;
  moneda?: Moneda;
  notas?: string;
}) =>
  apiClient.post<StockProduct>('/api/stock/products', body).then(r => r.data);

export const patchStockProduct = (id: string, body: Partial<{
  nombre: string;
  descripcion: string | null;
  categoria: string;
  unidad: string;
  stockMinimo: number;
  costoPromedio: number;
  moneda: Moneda;
  notas: string | null;
  activo: boolean;
}>) =>
  apiClient.patch<StockProduct>(`/api/stock/products/${id}`, body).then(r => r.data);

export const deleteStockProduct = (id: string) =>
  apiClient.delete(`/api/stock/products/${id}`);

// ─── Movements ────────────────────────────────────────────────────────────────

export const getStockMovements = (params?: { productId?: string; projectId?: string; tipo?: string; page?: number; limit?: number }) =>
  apiClient.get<PaginatedResponse<StockMovement>>('/api/stock/movements', { params }).then(r => r.data);

export const createStockMovement = (body: {
  fecha: string;
  productId: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  costoUnitario?: number;
  moneda?: Moneda;
  supplierId?: string;
  projectId?: string;
  referencia?: string;
  observaciones?: string;
}) =>
  apiClient.post('/api/stock/movements', body).then(r => r.data);

export const getProductMovements = (productId: string, params?: { page?: number; limit?: number }) =>
  apiClient.get<{
    product: { id: string; nombre: string; categoria: string; unidad: string; stockActual: number };
    data: StockMovement[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/api/stock/products/${productId}/movements`, { params }).then(r => r.data);

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const getStockAlerts = () =>
  apiClient.get<{
    id: string;
    nombre: string;
    categoria: string;
    unidad: string;
    stockActual: number;
    stockMinimo: number;
    moneda: Moneda;
    ratio: number;
  }[]>('/api/stock/alerts').then(r => r.data);
