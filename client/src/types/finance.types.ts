// ─── Finance & Stock types ────────────────────────────────────────────────────

export type Moneda = 'USD' | 'UYU';
export type TipoMovimiento = 'INGRESO' | 'GASTO' | 'AJUSTE';
export type FinanceMovementStatus = 'PREVISTO' | 'COMPROMETIDO' | 'A_PAGAR' | 'PARCIALMENTE_PAGADO' | 'PAGADO';
export type MovementSourceType = 'MANUAL' | 'PROJECT_MATERIALS';
export type CategoriaPrincipal =
  | 'PROYECTO_ENTRADA' | 'COBRO_CLIENTE'
  | 'PROYECTO_SALIDA' | 'COMPRA_STOCK' | 'CONSUMO_STOCK' | 'PAGO_PROVEEDOR'
  | 'FIJO' | 'VARIABLE' | 'OTRO';
export type MetodoPago = 'TRANSFERENCIA' | 'EFECTIVO' | 'CHEQUE' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'CRYPTO' | 'OTRO';
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
  PARCIALMENTE_PAGADO: 'Parcialmente pagado',
  PAGADO: 'Pagado',
};

export const STATUS_COLOR: Record<FinanceMovementStatus, string> = {
  PREVISTO: 'bg-[var(--color-border)] text-[var(--color-text-muted)] border border-[var(--color-border-hover)]',
  COMPROMETIDO: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  A_PAGAR: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  PARCIALMENTE_PAGADO: 'bg-amber-500/20 text-amber-300',
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
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CRYPTO: 'Crypto',
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
  /** Disponible cuando se pide GET /finance/suppliers?withBalance=true */
  balance?: {
    facturasPendientesUSD: number;
    facturasPendientesUYU: number;
    saldoAFavorUSD: number;
    saldoAFavorUYU: number;
    saldoNetoUSD: number;
    saldoNetoUYU: number;
    facturasPendientesCount: number;
    ultimaActividad: string | null;
  };
}

export interface Subcategoria {
  id: string;
  nombre: string;
  categoriaPrincipal: CategoriaPrincipal;
  activa: boolean;
}

export interface FinanceMovement {
  /** Discriminador de la lista unificada. En FinanceMovement siempre es
   *  'MOVEMENT' o undefined (para callers legacy). */
  _type?: 'MOVEMENT';
  /** True si el movement tiene PaymentApplication activa: el saldo NO se
   *  descuenta vía esta fila (lo hace el Payment correspondiente). */
  tieneApp?: boolean;
  id: string;
  fecha: string;
  anio: number;
  mes: number;
  tipoMovimiento: TipoMovimiento;
  categoriaPrincipal: CategoriaPrincipal;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  ivaTasa: number | null;
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
  // Saldos calculados desde payment_applications activas (sólo gastos)
  montoPagado: number;
  saldoPendiente: number;
  // Saldo USD proyectado GLOBAL (no respeta filtros), ordenado por
  // `fechaEfectiva` ASC. Considera TODOS los movimientos (INGRESO suma,
  // GASTO resta) — los pendientes (no PAGADO/COBRADO) cuentan como
  // proyección de flujo. La UI distingue real vs proyectado con color.
  saldoAcumuladoUSD: number;
  // true si el movimiento ya concretó dinero (PAGADO o cobrado=true), false
  // si el saldo correspondiente a esta fila es proyectado.
  saldoEsReal: boolean;
  // Fecha que se usó para ordenar este movimiento en el cálculo del saldo:
  // PAGADO/COBRADO → fecha; sino expectedDate ?? dueDate ?? fecha.
  fechaEfectiva: string;
  accountId: string | null;
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

/** Fila tipo PAYMENT en la lista unificada de /finance/movements. Es un Payment
 *  serializado para coexistir con FinanceMovement en la misma lista. */
export interface PaymentRow {
  _type: 'PAYMENT';
  id: string;
  fecha: string;
  fechaEfectiva: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  metodo: MetodoPago;
  referencia: string | null;
  notas: string | null;
  supplierId: string;
  supplier: { id: string; nombre: string } | null;
  accountId: string | null;
  account: { id: string; nombre: string; moneda: Moneda } | null;
  applications: Array<{
    id: string;
    movementId: string;
    montoAplicado: number;
    movement: { id: string; descripcion: string; monto: number; moneda: Moneda } | null;
  }>;
  saldoAcumuladoUSD: number;
  saldoEsReal: true;
  createdAt: string;
  updatedAt: string;
}

/** Item unificado de la lista. Backend serializa con _type para discriminar. */
export type FinanceListItem = FinanceMovement | PaymentRow;

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
  // Versiones con IVA (G.7)
  ingresosConIva: number;
  gastosConIva: number;
  resultadoConIva: number;
  pendienteCobroConIva: number;
  pendientePagoConIva: number;
  ultimosMovimientos: {
    id: string;
    fecha: string;
    descripcion: string;
    tipoMovimiento: TipoMovimiento;
    monto: number;
    moneda: Moneda;
    ivaTasa: number | null;
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
  // Versiones con IVA (G.7)
  porCobrarConIva: number;
  porPagarConIva: number;
  saldoProyectadoConIva: number;
  previstoTotalConIva: number;
  comprometidoTotalConIva: number;
  aPagarTotalConIva: number;
  saldoProyectadoSinPrevistosConIva: number;
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
  accountId?: string;
  observaciones?: string;
}
