import { apiClient } from './axios';
import type { Moneda, StockMovement, StockProduct, TipoMovimientoStock } from '../types/finance.types';
import type { PaginatedResponse } from '../types/api.types';

// ─── Products (legacy path; backend resuelve sobre MaterialItem) ─────────────

export const getStockProducts = (params?: {
  categoryId?: string;
  categoria?: string;
  activo?: boolean;
  gestionaStock?: 'true' | 'false' | 'all';
}) =>
  apiClient.get<StockProduct[]>('/api/stock/products', { params }).then(r => r.data);

// ─── Movements ────────────────────────────────────────────────────────────────

export const getStockMovements = (params?: {
  materialItemId?: string;
  /** @deprecated usar materialItemId */
  productId?: string;
  projectId?: string;
  tipo?: TipoMovimientoStock;
  includeReversed?: 'true' | 'false';
  page?: number;
  limit?: number;
}) =>
  apiClient.get<PaginatedResponse<StockMovement>>('/api/stock/movements', { params }).then(r => r.data);

export const createStockMovement = (body: {
  fecha: string;
  materialItemId?: string;
  /** @deprecated usar materialItemId */
  productId?: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  costoUnitario?: number;
  moneda?: Moneda;
  supplierId?: string;
  projectId?: string;
  financeMovementId?: string;
  causaIngreso?: 'FACTURA' | 'DEVOLUCION_PROVEEDOR' | 'AJUSTE_INVENTARIO' | 'IMPORTACION_INICIAL' | 'OTRO';
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
