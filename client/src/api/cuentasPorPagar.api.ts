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

// ─── Conciliación con el estado de cuenta del proveedor ────────────────────

export interface LineaEstado {
  fecha: string | null;
  tipo: 'FACTURA' | 'NOTA_CREDITO' | 'PAGO' | 'OTRO';
  numero: string | null;
  descripcion: string | null;
  importe: number;
}
export interface ItemVoltia {
  id: string; clase: 'FACTURA' | 'PAGO'; fecha: string; numero: string | null; descripcion: string; importe: number;
}
export interface ConciliacionResumen {
  id: string;
  supplierId: string;
  moneda: Moneda;
  fechaCorte: string;
  archivoNombre: string;
  saldoProveedor: number | null;
  saldoVoltia: number;
  diferenciaSaldo: number | null;
  cuenta: { coinciden: number; diferenciasMonto: number; soloProveedor: number; soloVoltia: number };
  createdAt: string;
  calculadoAt: string;
}
export interface ConciliacionDetalle extends ConciliacionResumen {
  costUsd: number;
  resultado: {
    desde: string | null;
    coinciden: Array<{ linea: LineaEstado; voltia: ItemVoltia }>;
    diferenciasMonto: Array<{ linea: LineaEstado; voltia: ItemVoltia; diferencia: number }>;
    soloProveedor: LineaEstado[];
    soloVoltia: ItemVoltia[];
    otras: LineaEstado[];
  };
}

export const getConciliaciones = (supplierId: string) =>
  apiClient.get<ConciliacionResumen[]>(`/api/finance/suppliers/${supplierId}/conciliaciones`).then((r) => r.data);

export const getConciliacion = (id: string) =>
  apiClient.get<ConciliacionDetalle>(`/api/finance/conciliaciones/${id}`).then((r) => r.data);

export const subirEstadoDeCuenta = (supplierId: string, file: File, opts: { moneda?: Moneda; fechaCorte?: string }) => {
  const form = new FormData();
  form.append('file', file);
  return apiClient.post<ConciliacionDetalle>(
    `/api/finance/suppliers/${supplierId}/conciliaciones`, form,
    { params: opts, headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 },
  ).then((r) => r.data);
};

export const recompararConciliacion = (id: string) =>
  apiClient.post<ConciliacionDetalle>(`/api/finance/conciliaciones/${id}/recomparar`).then((r) => r.data);

/** Abre el estado de cuenta original en otra pestaña (la descarga lleva la sesión). */
export async function abrirArchivoConciliacion(id: string) {
  const r = await apiClient.get(`/api/finance/conciliaciones/${id}/archivo`, { responseType: 'blob' });
  const url = URL.createObjectURL(r.data as Blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
