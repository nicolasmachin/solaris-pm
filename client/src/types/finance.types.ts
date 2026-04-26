// ─── Finance & Stock types ────────────────────────────────────────────────────

export type Moneda = 'USD' | 'UYU';
export type TipoMovimiento = 'INGRESO' | 'GASTO' | 'AJUSTE';
export type FinanceMovementStatus = 'PREVISTO' | 'COMPROMETIDO' | 'A_PAGAR' | 'PAGADO';
export type MovementSourceType = 'MANUAL' | 'PROJECT_MATERIALS';
export type CategoriaPrincipal =
  | 'PROYECTO_ENTRADA' | 'COBRO_CLIENTE'
  | 'PROYECTO_SALIDA' | 'COMPRA_STOCK' | 'CONSUMO_STOCK' | 'PAGO_PROVEEDOR'
  | 'FIJO' | 'VARIABLE' | 'OTRO';
export type MetodoPago = 'TRANSFERENCIA' | 'EFECTIVO' | 'CHEQUE' | 'TARJETA' | 'OTRO';
export type EstadoAprobacion =
  | 'BORRADOR' | 'REGISTRADO' | 'PENDIENTE_APROBACION'
  | 'APROBADO' | 'RECHAZADO' | 'ANULADO';
export type TipoComprobante = 'FACTURA' | 'RECIBO' | 'NOTA_CREDITO' | 'PRESUPUESTO' | 'OTRO';
export type EstadoComprobante =
  | 'PENDIENTE' | 'PARCIALMENTE_PAGADO' | 'PAGADO' | 'VENCIDO' | 'ANULADO';
export type TipoMovimientoStock = 'INGRESO' | 'EGRESO' | 'AJUSTE';

// ─── Labels ───────────────────────────────────────────────────────────────────

export const CATEGORIA_LABEL: Record<CategoriaPrincipal, string> = {
  PROYECTO_ENTRADA: 'Entrada proyecto',
  COBRO_CLIENTE: 'Cobro cliente',
  PROYECTO_SALIDA: 'Salida proyecto',
  COMPRA_STOCK: 'Compra stock',
  CONSUMO_STOCK: 'Consumo stock',
  PAGO_PROVEEDOR: 'Pago proveedor',
  FIJO: 'Costo fijo',
  VARIABLE: 'Costo variable',
  OTRO: 'Otro',
};

export const TIPO_MOV_LABEL: Record<TipoMovimiento, string> = {
  INGRESO: 'Ingreso',
  GASTO: 'Gasto',
  AJUSTE: 'Ajuste',
};

export const STATUS_LABEL: Record<FinanceMovementStatus, string> = {
  PREVISTO: 'Previsto',
  COMPROMETIDO: 'Comprometido',
  A_PAGAR: 'A pagar',
  PAGADO: 'Pagado',
};

export const STATUS_COLOR: Record<FinanceMovementStatus, string> = {
  PREVISTO: 'bg-[var(--color-border)] text-[var(--color-text-muted)] border border-[var(--color-border-hover)]',
  COMPROMETIDO: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  A_PAGAR: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  PAGADO: 'bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]',
};

export const ESTADO_APROBACION_LABEL: Record<EstadoAprobacion, string> = {
  BORRADOR: 'Borrador',
  REGISTRADO: 'Registrado',
  PENDIENTE_APROBACION: 'Pendiente aprobación',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};

export const ESTADO_COMPROBANTE_LABEL: Record<EstadoComprobante, string> = {
  PENDIENTE: 'Pendiente',
  PARCIALMENTE_PAGADO: 'Parcial',
  PAGADO: 'Pagado',
  VENCIDO: 'Vencido',
  ANULADO: 'Anulado',
};

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
  TARJETA: 'Tarjeta',
  OTRO: 'Otro',
};

export const CATEGORIAS_INGRESO: CategoriaPrincipal[] = ['PROYECTO_ENTRADA', 'COBRO_CLIENTE'];

export const CATEGORIAS_POR_TIPO: Record<TipoMovimiento, CategoriaPrincipal[]> = {
  INGRESO: ['PROYECTO_ENTRADA', 'COBRO_CLIENTE', 'OTRO'],
  GASTO: ['FIJO', 'VARIABLE', 'PROYECTO_SALIDA', 'COMPRA_STOCK', 'CONSUMO_STOCK', 'PAGO_PROVEEDOR', 'OTRO'],
  AJUSTE: ['OTRO'],
};

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface ExchangeRate {
  id: string;
  date: string;
  usdToUyu: number;
  source: string | null;
  createdById: string | null;
}

export interface Supplier {
  id: string;
  nombre: string;
  rut: string | null;
  contactoNombre: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  condicionPago: string | null;
  notas: string | null;
  activo: boolean;
  createdAt: string;
  _count?: { movimientos: number; comprobantes: number };
}

export interface Subcategoria {
  id: string;
  nombre: string;
  categoriaPrincipal: CategoriaPrincipal;
  activa: boolean;
}

export interface FinanceMovement {
  id: string;
  fecha: string;
  anio: number;
  mes: number;
  tipoMovimiento: TipoMovimiento;
  categoriaPrincipal: CategoriaPrincipal;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  tipoCambio: number | null;
  pagado: boolean;
  cobrado: boolean;
  impactaFlujo: boolean;
  status: FinanceMovementStatus;
  expectedDate: string | null;
  dueDate: string | null;
  sourceType: MovementSourceType;
  materialItemId: string | null;
  materialItem?: { id: string; nombre: string; unidad: string } | null;
  quantity: number | null;
  unitPrice: number | null;
  // Desglose de factura
  requiresItemDetail: boolean;
  hasItemDetail: boolean;
  noTieneMateriales: boolean;
  estadoAprobacion: EstadoAprobacion;
  projectId: string | null;
  project: { id: string; code: string; clientName: string } | null;
  supplierId: string | null;
  supplier: { id: string; nombre: string } | null;
  subcategoriaId: string | null;
  subcategoria: { id: string; nombre: string } | null;
  observaciones: string | null;
  createdAt: string;
}

export interface PrevistoPendiente {
  id: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  quantity: number | null;
  unitPrice: number | null;
  fecha: string;
  expectedDate: string | null;
  project: { id: string; code: string; clientName: string } | null;
  supplier: { id: string; nombre: string } | null;
  materialItem: {
    id: string;
    nombre: string;
    unidad: string;
    category: { id: string; nombre: string };
  } | null;
}

export interface FinanceComprobante {
  id: string;
  supplierId: string;
  supplier: { id: string; nombre: string } | null;
  numero: string | null;
  tipo: TipoComprobante;
  concepto: string;
  monto: number;
  moneda: Moneda;
  fechaEmision: string;
  fechaVencimiento: string | null;
  estado: EstadoComprobante;
  movimientoId: string | null;
  montoPagado: number;
  saldoPendiente: number;
  createdAt: string;
}

// StockProduct ahora es un alias del shape que devuelve /api/stock/products,
// que internamente es un MaterialItem con gestionaStock=true. Mantenemos el
// nombre para no romper el resto del frontend pero los campos nuevos
// (gestionaStock, ubicacionDeposito, precioSugerido, categoryId,
// defaultSupplier) reflejan el modelo unificado. costoPromedio ya no existe.
export interface StockProduct {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;        // nombre de la categoría (legacy)
  categoryId: string;
  unidad: string;
  moneda: Moneda;
  activo: boolean;
  gestionaStock: boolean;
  stockActual: number;
  stockMinimo: number | null;
  ubicacionDeposito: string | null;
  precioSugerido: number | null;
  defaultSupplier: { id: string; nombre: string } | null;
  bajominimo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  fecha: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  costoUnitario: number | null;
  costoTotal: number | null;
  stockResultante: number;
  moneda: Moneda;
  materialItemId: string;
  // alias legacy `product` mientras migramos la UI
  product: { id: string; nombre: string; categoria: string; unidad: string } | null;
  materialItem: {
    id: string; nombre: string; unidad: string;
    category: { id: string; nombre: string } | null;
  } | null;
  supplier: { id: string; nombre: string } | null;
  project: { id: string; code: string; clientName: string } | null;
  financeMovementId: string | null;
  invoiceItemId: string | null;
  causaIngreso: 'FACTURA' | 'DEVOLUCION_PROVEEDOR' | 'AJUSTE_INVENTARIO' | 'IMPORTACION_INICIAL' | 'OTRO' | null;
  reversed: boolean;
  referencia: string | null;
  observaciones: string | null;
  createdAt: string;
}

// ─── Report types ─────────────────────────────────────────────────────────────

export interface FinanceDashboard {
  mes: number;
  anio: number;
  ingresos: number;
  gastos: number;
  resultado: number;
  pendienteCobro: number;
  pendientePago: number;
  ultimosMovimientos: {
    id: string;
    fecha: string;
    descripcion: string;
    tipoMovimiento: TipoMovimiento;
    monto: number;
    moneda: Moneda;
    project: { id: string; code: string; clientName: string } | null;
    supplier: { id: string; nombre: string } | null;
  }[];
}

export interface FinanceCashflow {
  saldoActual: number;
  porCobrar: number;
  porPagar: number;
  saldoProyectado: number;
  previstoTotal: number;
  comprometidoTotal: number;
  aPagarTotal: number;
  saldoProyectadoSinPrevistos: number;
}

export interface FinanceResultsMes {
  mes: number;
  entradas: number;
  costoInstalaciones: number;
  resultadoBruto: number;
  costosFijos: number;
  costosVariables: number;
  totalCostosOp: number;
  resultadoOperativo: number;
}

export interface FinanceResults {
  anio: number;
  meses: FinanceResultsMes[];
  totales: FinanceResultsMes;
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface MovimientoFormData {
  fecha: string;
  tipoMovimiento: TipoMovimiento;
  categoriaPrincipal: CategoriaPrincipal;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  tipoCambio?: number;
  pagado: boolean;
  cobrado: boolean;
  impactaFlujo: boolean;
  status: FinanceMovementStatus;
  expectedDate?: string;
  dueDate?: string;
  estadoAprobacion: EstadoAprobacion;
  proyectoId?: string;
  proveedorId?: string;
  subcategoriaId?: string;
  observaciones?: string;
}
