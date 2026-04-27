import type { FinanceMovementStatus, MetodoPago, Moneda } from './finance.types';

export interface PaymentApplicationLite {
  id: string;
  movementId: string;
  montoAplicado: number;
  createdAt: string;
  movement: {
    id: string;
    descripcion: string;
    monto: number;
    moneda: Moneda;
    status: FinanceMovementStatus;
    fecha: string;
    dueDate: string | null;
  } | null;
}

export interface Payment {
  id: string;
  supplierId: string;
  supplier: { id: string; nombre: string } | null;
  accountId: string | null;
  account: { id: string; nombre: string; tipo: 'BANCO' | 'EFECTIVO' | 'TARJETA' | 'OTRO'; moneda: Moneda } | null;
  fecha: string;
  monto: number;
  moneda: Moneda;
  metodo: MetodoPago;
  referencia: string | null;
  notas: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  montoAplicado: number;
  saldoSinAplicar: number;
  applications?: PaymentApplicationLite[];
}

export interface AccountSummaryFactura {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  montoPagado: number;
  saldoPendiente: number;
  status: FinanceMovementStatus;
  dueDate: string | null;
}

export interface AccountSummaryPago {
  id: string;
  fecha: string;
  monto: number;
  moneda: Moneda;
  metodo: MetodoPago;
  referencia: string | null;
  montoAplicado: number;
  saldoSinAplicar: number;
}

export interface AccountSummaryEvent {
  tipo: 'factura' | 'pago';
  fecha: string;
  monto: number;
  moneda: Moneda;
  descripcion: string;
  saldoAcumuladoUSD: number;
}

export interface AccountSummary {
  supplier: {
    id: string;
    nombre: string;
    rut: string | null;
    contactoNombre: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
    condicionPago: string | null;
  };
  totals: {
    facturasPendientesUSD: number;
    facturasPendientesUYU: number;
    saldoAFavorUSD: number;
    saldoAFavorUYU: number;
    saldoNetoUSD: number;
    saldoNetoUYU: number;
  };
  exchangeRate: { usdToUyu: number; date: string } | null;
  facturas: AccountSummaryFactura[];
  pagos: AccountSummaryPago[];
  estadoDeCuenta: AccountSummaryEvent[];
}
