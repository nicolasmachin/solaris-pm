import { apiClient } from './axios';

type Moneda = 'USD' | 'UYU';
export type Tramo = 'VENCIDO' | 'HASTA_7' | 'HASTA_30' | 'MAS_30';
export type TotalesTramo = Record<Tramo, number> & { total: number };

export interface FacturaAPagar {
  id: string;
  descripcion: string;
  invoiceNumber: string | null;
  monto: number;
  saldo: number;
  moneda: Moneda;
  fechaEmision: string;
  vencimiento: string;
  diasParaVencer: number;
  tramo: Tramo;
  status: string;
  project: { id: string; code: string; clientName: string } | null;
}

export interface ProveedorAPagar {
  supplier: {
    id: string; nombre: string; rut: string | null; activo: boolean;
    plazoCreditoDias: number; limiteCredito: number | null; limiteCreditoMoneda: Moneda;
  };
  USD: TotalesTramo;
  UYU: TotalesTramo;
  saldoAFavor: { USD: number; UYU: number };
  neto: { USD: number; UYU: number };
  limite: { monto: number; moneda: Moneda; usado: number; disponible: number; excedido: boolean } | null;
  proximoVencimiento: string | null;
  facturas: FacturaAPagar[];
}

export interface CuentasPorPagarDto {
  hoy: string;
  totales: { USD: TotalesTramo; UYU: TotalesTramo };
  proveedores: ProveedorAPagar[];
}

export const getCuentasPorPagar = () =>
  apiClient.get<CuentasPorPagarDto>('/api/finance/cuentas-por-pagar').then((r) => r.data);

export type EstadoFacturaRecibida = 'PENDIENTE' | 'CONFIRMADA' | 'DESCARTADA';

export interface FacturaRecibida {
  id: string;
  rutEmisor: string;
  razonSocialEmisor: string | null;
  tipoCfe: number;
  tipoLabel: string;
  esNotaCredito: boolean;
  serie: string;
  numero: number;
  fechaEmision: string;
  fechaVencimientoCfe: string | null;
  vencimientoPorPlazo: string | null;
  moneda: Moneda;
  total: number;
  totalIva: number | null;
  enDgi: boolean;
  enMail: boolean;
  estado: EstadoFacturaRecibida;
  motivoDescarte: string | null;
  supplier: { id: string; nombre: string } | null;
  movement: { id: string; descripcion: string; status: string } | null;
  candidatas: Array<{ id: string; descripcion: string; invoiceNumber: string | null; monto: number; fecha: string | null; status: string }>;
}

export interface EstadoSync {
  at: string;
  ok: boolean;
  resultado?: { nuevas: number; actualizadas: number; ignoradas: number; desde: string; hasta: string };
  error?: string;
}

export interface FacturasRecibidasDto {
  billerConfigurado: boolean;
  ultimaSync: EstadoSync | null;
  facturas: FacturaRecibida[];
}

export const getFacturasRecibidas = (estado: EstadoFacturaRecibida | 'todas') =>
  apiClient.get<FacturasRecibidasDto>('/api/finance/facturas-recibidas', { params: { estado } }).then((r) => r.data);

export const sincronizarFacturasRecibidas = () =>
  apiClient.post<EstadoSync>('/api/finance/facturas-recibidas/sincronizar').then((r) => r.data);

export const confirmarFacturaRecibida = (id: string, body: { supplierId?: string; projectId?: string | null; fechaVencimiento?: string; descripcion?: string }) =>
  apiClient.post<{ movementId: string }>(`/api/finance/facturas-recibidas/${id}/confirmar`, body).then((r) => r.data);

export const vincularFacturaRecibida = (id: string, movementId: string) =>
  apiClient.post(`/api/finance/facturas-recibidas/${id}/vincular`, { movementId }).then((r) => r.data);

export const descartarFacturaRecibida = (id: string, motivo: string) =>
  apiClient.post(`/api/finance/facturas-recibidas/${id}/descartar`, { motivo }).then((r) => r.data);

export const reabrirFacturaRecibida = (id: string) =>
  apiClient.post(`/api/finance/facturas-recibidas/${id}/reabrir`).then((r) => r.data);

// ─── Registro de todas las facturas de proveedores ─────────────────────────

export interface FacturaProveedorFila {
  origen: 'ELECTRONICA' | 'MANUAL';
  id: string;
  fechaEmision: string | null;
  proveedor: { id: string; nombre: string } | null;
  rut: string | null;
  razonSocial: string | null;
  comprobante: string;
  descripcion: string | null;
  moneda: Moneda;
  totalNeto: number | null;
  iva: number | null;
  total: number;
  saldo: number | null;
  vencimiento: string | null;
  estadoBandeja: EstadoFacturaRecibida | null;
  motivoDescarte: string | null;
  estadoPago: string | null;
  enDgi: boolean;
  enMail: boolean;
  project: { id: string; code: string; clientName: string } | null;
}

export interface FacturasProveedoresDto {
  facturas: FacturaProveedorFila[];
  totales: Partial<Record<Moneda, number>>;
  emisoresSinAlta: Array<{ rut: string; razonSocial: string | null; facturas: number }>;
}

export const getFacturasProveedores = (params: {
  proveedor?: string; desde?: string; hasta?: string;
  origen?: 'todas' | 'electronica' | 'manual'; buscar?: string;
}) =>
  apiClient.get<FacturasProveedoresDto>('/api/finance/facturas-proveedores', { params }).then((r) => r.data);

export const crearProveedorDesdeRut = (rut: string, nombre?: string) =>
  apiClient.post<{ supplierId: string; nombre: string; facturasAsignadas: number }>(
    '/api/finance/facturas-recibidas/crear-proveedor', { rut, ...(nombre ? { nombre } : {}) },
  ).then((r) => r.data);
