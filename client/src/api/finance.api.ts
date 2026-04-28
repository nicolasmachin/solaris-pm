import { apiClient } from './axios';
import type {
  ExchangeRate,
  FinanceCashflow,
  FinanceComprobante,
  FinanceDashboard,
  FinanceMovement,
  FinanceMovementStatus,
  FinanceResults,
  MetodoPago,
  Moneda,
  MovimientoFormData,
  PrevistoPendiente,
  Subcategoria,
  Supplier,
  TipoComprobante,
  EstadoComprobante,
} from '../types/finance.types';
import type { PaginatedResponse } from '../types/api.types';

// ─── Exchange Rate ────────────────────────────────────────────────────────────

export const getExchangeRate = () =>
  apiClient.get<ExchangeRate>('/api/finance/exchange-rate').then(r => r.data);

export const createExchangeRate = (body: { date: string; usdToUyu: number }) =>
  apiClient.post<ExchangeRate>('/api/finance/exchange-rate', body).then(r => r.data);

export const getExchangeRateHistory = () =>
  apiClient.get<ExchangeRate[]>('/api/finance/exchange-rate/history').then(r => r.data);

// Consulta el TC del BCU sin guardar — para sugerir un valor en el modal de
// "actualizar TC". El usuario decide si lo aplica vía createExchangeRate.
export const getBcuExchangeRatePreview = () =>
  apiClient
    .get<{ fechaIso: string; usdToUyu: number }>('/api/finance/exchange-rate/bcu-preview')
    .then(r => r.data);

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const getSuppliers = (params?: { activo?: 'true' | 'false' | 'all'; withBalance?: 'true' | 'false' }) =>
  apiClient.get<Supplier[]>('/api/finance/suppliers', { params }).then(r => r.data);

export const getSupplier = (id: string) =>
  apiClient.get<Supplier>(`/api/finance/suppliers/${id}`).then(r => r.data);

export const createSupplier = (body: {
  nombre: string;
  rut?: string;
  contactoNombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  condicionPago?: string;
  notas?: string;
}) =>
  apiClient.post<Supplier>('/api/finance/suppliers', body).then(r => r.data);

export const patchSupplier = (id: string, body: Partial<{
  nombre: string;
  rut: string | null;
  contactoNombre: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  condicionPago: string | null;
  notas: string | null;
  activo: boolean;
}>) =>
  apiClient.patch<Supplier>(`/api/finance/suppliers/${id}`, body).then(r => r.data);

export const deleteSupplier = (id: string) =>
  apiClient.delete(`/api/finance/suppliers/${id}`);

// ─── Subcategories ────────────────────────────────────────────────────────────

export const getSubcategories = (params?: { categoria?: string }) =>
  apiClient.get<Subcategoria[]>('/api/finance/subcategories', { params }).then(r => r.data);

export const createSubcategory = (body: { nombre: string; categoriaPrincipal: string }) =>
  apiClient.post<Subcategoria>('/api/finance/subcategories', body).then(r => r.data);

export const deleteSubcategory = (id: string) =>
  apiClient.delete(`/api/finance/subcategories/${id}`);

// ─── Movements ────────────────────────────────────────────────────────────────

export interface MovimientosQuery {
  page?: number;
  limit?: number;
  anio?: number;
  mes?: number;
  tipo?: string;
  categoria?: string;
  status?: FinanceMovementStatus;
  projectId?: string;
  search?: string;
}

export interface MovementsListResponse extends PaginatedResponse<FinanceMovement> {
  saldoFinalUSD: number;
}

export const getMovements = (params: MovimientosQuery) =>
  apiClient.get<MovementsListResponse>('/api/finance/movements', { params }).then(r => r.data);

export interface FinanceMovementDetail extends FinanceMovement {
  paymentApplications: Array<{
    id: string;
    paymentId: string;
    montoAplicado: number;
    createdAt: string;
    payment: {
      id: string;
      fecha: string;
      monto: number;
      moneda: Moneda;
      metodo: string;
      referencia: string | null;
      deletedAt: string | null;
    };
  }>;
}

export const getMovement = (id: string) =>
  apiClient.get<FinanceMovementDetail>(`/api/finance/movements/${id}`).then(r => r.data);

function buildMovementBody(body: Partial<MovimientoFormData>) {
  return {
    ...(body.fecha != null ? { fecha: body.fecha } : {}),
    ...(body.tipoMovimiento ? { tipoMovimiento: body.tipoMovimiento } : {}),
    ...(body.categoriaPrincipal ? { categoriaPrincipal: body.categoriaPrincipal } : {}),
    ...(body.descripcion != null ? { descripcion: body.descripcion } : {}),
    ...(body.monto != null ? { monto: body.monto } : {}),
    ...(body.moneda ? { moneda: body.moneda } : {}),
    ...(body.tipoCambio != null ? { tipoCambio: body.tipoCambio } : {}),
    ...(body.pagado != null ? { pagado: body.pagado } : {}),
    ...(body.cobrado != null ? { cobrado: body.cobrado } : {}),
    ...(body.impactaFlujo != null ? { impactaFlujo: body.impactaFlujo } : {}),
    ...(body.status ? { status: body.status } : {}),
    ...(body.expectedDate ? { expectedDate: body.expectedDate } : {}),
    ...(body.dueDate ? { dueDate: body.dueDate } : {}),
    ...(body.estadoAprobacion ? { estadoAprobacion: body.estadoAprobacion } : {}),
    ...(body.proyectoId ? { projectId: body.proyectoId } : {}),
    ...(body.proveedorId ? { supplierId: body.proveedorId } : {}),
    ...(body.subcategoriaId ? { subcategoriaId: body.subcategoriaId } : {}),
    ...(body.accountId ? { accountId: body.accountId } : {}),
    ...(body.observaciones ? { observaciones: body.observaciones } : {}),
  };
}

export const createMovement = (body: MovimientoFormData) =>
  apiClient.post<FinanceMovement>('/api/finance/movements', buildMovementBody(body)).then(r => r.data);

export const patchMovement = (id: string, body: Partial<MovimientoFormData>) =>
  apiClient.patch<FinanceMovement>(`/api/finance/movements/${id}`, buildMovementBody(body)).then(r => r.data);

export const deleteMovement = (id: string) =>
  apiClient.delete<{ success: true; liberatedApplications: number; liberatedAmount: number }>(`/api/finance/movements/${id}`).then(r => r.data);

export const transitionMovement = (id: string, body: { newStatus: FinanceMovementStatus; paidDate?: string; dueDate?: string }) =>
  apiClient.post<{ id: string; status: FinanceMovementStatus; fecha: string; dueDate: string | null; pagado: boolean; requiresItemDetail: boolean }>(`/api/finance/movements/${id}/transition`, body).then(r => r.data);

export const cancelMovement = (id: string) =>
  apiClient.post<{ success: true; reversedStockMovements: number }>(`/api/finance/movements/${id}/cancel`).then(r => r.data);

// ─── Invoice items (desglose de factura) ─────────────────────────────────────

export interface InvoiceItem {
  id: string;
  movementId: string;
  materialItemId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  moneda: Moneda;
  ivaTasa: number;
  notes: string | null;
  materialItem: {
    id: string;
    nombre: string;
    unidad: string;
    gestionaStock: boolean;
    category: { id: string; nombre: string };
  } | null;
  stockMovement: { id: string; fecha: string; reversed: boolean } | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItemsResponse {
  movement: {
    id: string;
    monto: number;
    moneda: Moneda;
    status: FinanceMovementStatus;
    hasItemDetail: boolean;
    noTieneMateriales: boolean;
    requiresItemDetail: boolean;
  };
  items: InvoiceItem[];
  totalItems: number;
  diff: number;
  matches: boolean;
}

export const getInvoiceItems = (movementId: string) =>
  apiClient.get<InvoiceItemsResponse>(`/api/finance/movements/${movementId}/invoice-items`).then(r => r.data);

export const createInvoiceItem = (movementId: string, body: {
  materialItemId: string;
  quantity: number;
  unitPrice: number;
  moneda?: Moneda;
  ivaTasa?: number;
  notes?: string | null;
}) =>
  apiClient.post<InvoiceItem>(`/api/finance/movements/${movementId}/invoice-items`, body).then(r => r.data);

export const patchInvoiceItem = (movementId: string, itemId: string, body: Partial<{
  quantity: number;
  unitPrice: number;
  ivaTasa: number;
  notes: string | null;
}>) =>
  apiClient.patch<InvoiceItem>(`/api/finance/movements/${movementId}/invoice-items/${itemId}`, body).then(r => r.data);

export const deleteInvoiceItem = (movementId: string, itemId: string) =>
  apiClient.delete(`/api/finance/movements/${movementId}/invoice-items/${itemId}`);

export const confirmInvoiceItems = (movementId: string) =>
  apiClient.post<{ confirmed: true; itemsCount: number; total: number }>(`/api/finance/movements/${movementId}/invoice-items/confirm`).then(r => r.data);

export const markNoMateriales = (movementId: string) =>
  apiClient.post<{ id: string; noTieneMateriales: true; hasItemDetail: true }>(`/api/finance/movements/${movementId}/mark-no-materials`).then(r => r.data);

// ─── Pendientes de desglose ──────────────────────────────────────────────────

export interface PendingDetailMovement {
  id: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  status: FinanceMovementStatus;
  fecha: string;
  dueDate: string | null;
  project: { id: string; code: string; clientName: string } | null;
  supplier: { id: string; nombre: string } | null;
}

export const getPendingDetailMovements = () =>
  apiClient.get<PendingDetailMovement[]>('/api/finance/movements/pending-detail').then(r => r.data);

// ─── Cost summary del proyecto ───────────────────────────────────────────────

export interface CostSummaryConsumo {
  id: string;
  materialItemId: string;
  materialItemName: string;
  unidad: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  moneda: Moneda;
  subtotal: number;
  subtotalUSD: number;
  fecha: string;
  priceSource: 'movement' | 'catalog';
}

export interface CostSummaryCategoria {
  id: string;
  nombre: string;
  totalUSD: number;
  totalConIvaUSD?: number;
  itemCount: number;
}

export interface CostSummaryComparacion {
  materialItemId: string;
  nombre: string;
  unidad: string;
  categoryName: string;
  quantityPrevista: number;
  quantityReal: number;
  quantityDiff: number;
  subtotalPrevistoUSD: number;
  subtotalRealUSD: number;
  subtotalDiffUSD: number;
  subtotalPrevistoConIvaUSD?: number;
  subtotalRealConIvaUSD?: number;
  subtotalDiffConIvaUSD?: number;
}

export interface CostSummary {
  project: { id: string; code: string; clientName: string };
  budgetUsd: number | null;

  // PREVISTO (lista de Ingeniería)
  costoPrevistoUSD: number;
  costoPrevistoUYU: number;
  costoPrevistoTotalUSD: number;
  costoPrevistoConIvaUSD: number;
  costoPrevistoConIvaUYU: number;
  costoPrevistoTotalConIvaUSD: number;
  margenPrevistoUSD: number | null;
  margenPrevistoPercent: number | null;

  // REAL (consumos de stock)
  costoRealUSD: number;
  costoRealUYU: number;
  costoRealTotalUSD: number;
  costoRealConIvaUSD: number;
  costoRealConIvaUYU: number;
  costoRealTotalConIvaUSD: number;
  margenRealUSD: number | null;
  margenRealPercent: number | null;

  // Compat con UI vieja
  totalUsedUSD: number;
  totalUsedUYU: number;
  totalUsedUsdAll: number;
  itemCount: number;
  marginUSD: number | null;
  marginPercent: number | null;
  exchangeRate: { usdToUyu: number; date: string } | null;
  byCategoryUSD: CostSummaryCategoria[];
  movements: CostSummaryConsumo[];

  desglose: {
    previstoPorCategoria: CostSummaryCategoria[];
    realPorCategoria: CostSummaryCategoria[];
    comparacionPorItem: CostSummaryComparacion[];
    consumosDeStock: CostSummaryConsumo[];
  };
}

export const getProjectCostSummary = (projectId: string) =>
  apiClient.get<CostSummary>(`/api/projects/${projectId}/cost-summary`).then(r => r.data);

export const getPrevistosPendientes = (params?: { categoryId?: string; supplierId?: string; from?: string; to?: string }) =>
  apiClient.get<PrevistoPendiente[]>('/api/finance/movements/previstos-pendientes', { params }).then(r => r.data);

export const cleanupPrevistos = (movementIds: string[]) =>
  apiClient.post<{ deleted: number }>('/api/finance/movements/cleanup-previstos', { movementIds }).then(r => r.data);

// ─── Comprobantes ─────────────────────────────────────────────────────────────

export const getComprobantes = (params?: { supplierId?: string; estado?: string }) =>
  apiClient.get<FinanceComprobante[]>('/api/finance/comprobantes', { params }).then(r => r.data);

export const createComprobante = (body: {
  supplierId: string;
  tipo: TipoComprobante;
  concepto: string;
  monto: number;
  moneda: Moneda;
  fechaEmision: string;
  fechaVencimiento?: string;
  numero?: string;
}) =>
  apiClient.post<FinanceComprobante>('/api/finance/comprobantes', body).then(r => r.data);

export const patchComprobante = (id: string, body: Partial<{
  numero: string | null;
  concepto: string;
  fechaVencimiento: string | null;
  notas: string | null;
  archivoUrl: string | null;
  estado: EstadoComprobante;
}>) =>
  apiClient.patch<FinanceComprobante>(`/api/finance/comprobantes/${id}`, body).then(r => r.data);

export const registrarPagoComprobante = (id: string, body: {
  fecha: string;
  monto: number;
  moneda: Moneda;
  metodoPago: MetodoPago;
  referencia?: string;
  observaciones?: string;
}) =>
  apiClient.post(`/api/finance/comprobantes/${id}/payments`, body).then(r => r.data);

// ─── Reports ──────────────────────────────────────────────────────────────────

export const getDashboard = (mes: number, anio: number) =>
  apiClient.get<FinanceDashboard>('/api/finance/reports/dashboard', { params: { mes, anio } }).then(r => r.data);

export const getCashflow = (params?: { fechaDesde?: string; fechaHasta?: string }) =>
  apiClient.get<FinanceCashflow>('/api/finance/reports/cashflow', { params }).then(r => r.data);

export const getResults = (anio: number) =>
  apiClient.get<FinanceResults>('/api/finance/reports/results', { params: { anio } }).then(r => r.data);

export const getByProject = (projectId: string) =>
  apiClient.get(`/api/finance/reports/by-project/${projectId}`).then(r => r.data);
