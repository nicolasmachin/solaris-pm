// Tipos del motor de cálculo de reportes fotovoltaicos.
//
// Todo lo de esta carpeta es PURO: sin Prisma, sin I/O, sin fechas del sistema.
// Los servicios de arriba resuelven la config efectiva y las tarifas vigentes y
// se las pasan ya materializadas. Eso es lo que permite testear el motor contra
// las 282 filas de histórico real sin levantar nada.

export type TarifaKey = "simple" | "doble" | "triple" | "zafral";

export const TARIFAS: readonly TarifaKey[] = ["simple", "doble", "triple", "zafral"] as const;

export interface TramoEscalonado {
  desdeKwh: number;
  hastaKwh: number;
  precioKwh: number;
}

export interface CargosTarifa {
  cargoFijo: number;
  cargoPotenciaKw: number;
}

/** Cuadro tarifario completo de un periodo, ya resuelto por vigencia. */
export interface TarifaSnapshot {
  cargos: Record<TarifaKey, CargosTarifa>;
  tramosSimple: TramoEscalonado[];
  franjasDoble: { punta: number; fuera_punta: number };
  franjasTriple: { punta: number; llano: number; valle: number };
  franjasZafral: { punta: number; llano: number; valle: number };
  ivaPct: number;
  irpfPct: number;
}

export interface Factura {
  cargoFijo: number;
  cargoPotencia: number;
  cargoEnergia: number;
  baseGravada: number;
  iva: number;
  creditoExportacion: number;
  irpf: number;
  totalBruto: number;
  totalNeto: number;
  saldoAFavor: number;
}

/** Factura después de aplicar el saldo arrastrado de la cuenta corriente UTE. */
export interface FacturaAjustada extends Factura {
  totalNetoPrevioCc: number;
  saldoInicial: number;
  saldoAplicado: number;
  saldoGeneradoMes: number;
  saldoFinal: number;
}

export interface DesgloseBeneficio {
  ahorroAutoconsumo: number;
  ahorroVenta: number;
  ahorroTotal: number;
  pctAutoconsumo: number;
  pctVenta: number;
}
