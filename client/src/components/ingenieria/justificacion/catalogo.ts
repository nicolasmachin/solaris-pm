// Cargas sugeridas para el informe de justificación de potencia ante UTE.
// Salen de los informes que Voltia mandó a mano (ESTILO, Soler, Filippa,
// García Rodríguez, Coviteja): los valores son el punto de partida típico y
// el proyectista los ajusta en cada caso.

import type {
  CargaJustificacion,
  DatosJustificacion,
  MotivoAntecedente,
} from "../../../api/justificacionPotencia.api";

export interface CargaSugerida {
  key: string;
  concepto: string;
  carga: Omit<CargaJustificacion, "id" | "concepto">;
}

const desglose = (potenciaKw: number, horasDia: number, diasMes: number, cantidad = 1) =>
  ({ tipo: "CARGA", modo: "DESGLOSE", potenciaKw, horasDia, diasMes, cantidad }) as const;
const directo = (kwhMes: number) => ({ tipo: "CARGA", modo: "DIRECTO", kwhMes }) as const;

export const CARGAS_SUGERIDAS: CargaSugerida[] = [
  { key: "aire", concepto: "Climatización (aire acondicionado)", carga: desglose(1.2, 6, 20, 2) },
  { key: "ev", concepto: "Carga de vehículo eléctrico", carga: desglose(7, 1.5, 30) },
  { key: "piscina-calor", concepto: "Bomba de calor para climatización de piscina", carga: desglose(3, 6, 22) },
  { key: "piscina-bomba", concepto: "Piscina y sistema de circulación", carga: desglose(1, 6, 30) },
  { key: "agua", concepto: "Agua caliente eléctrica (termotanque o bomba de calor)", carga: desglose(1.5, 3, 30) },
  { key: "cocina", concepto: "Cocina y horno eléctricos (sustitución de gas)", carga: desglose(2, 2, 30) },
  { key: "calefaccion", concepto: "Calefacción eléctrica / losa radiante", carga: desglose(2.5, 6, 25) },
  { key: "unidades", concepto: "Unidades habitacionales nuevas (cabañas, apartamentos)", carga: desglose(2, 6, 8, 2) },
  { key: "oficinas", concepto: "Ampliación edilicia (oficinas y mayor dotación de personal)", carga: directo(500) },
  { key: "taller", concepto: "Taller y herramientas eléctricas", carga: desglose(4, 5, 25) },
  { key: "riego", concepto: "Bombeo y sistema de riego", carga: desglose(2, 5, 30) },
  { key: "ilum-ext", concepto: "Iluminación exterior", carga: desglose(1, 8, 30) },
  { key: "lavanderia", concepto: "Lavandería (lavarropas y secarropas)", carga: desglose(3, 5, 30) },
  { key: "seguridad", concepto: "Sistema de seguridad (cámaras, alarma y portería)", carga: desglose(0.3, 24, 30) },
  { key: "generales", concepto: "Electrodomésticos y tomas de uso general", carga: directo(300) },
];

export const MOTIVOS: { value: MotivoAntecedente; label: string; ayuda: string }[] = [
  { value: "NUEVAS_CARGAS", label: "Se suman cargas nuevas", ayuda: "Vivienda o empresa que incorpora equipos de alto consumo." },
  { value: "EN_CONSTRUCCION", label: "Obra en construcción", ayuda: "Las cargas principales todavía no están operativas." },
  { value: "RECIEN_HABILITADO", label: "Instalación recién habilitada", ayuda: "Cooperativa, local o vivienda que recién empieza a funcionar." },
  { value: "UNIFICACION", label: "Mudanza o unificación de cuentas", ayuda: "Consumos de otras cuentas pasan a esta." },
];

let seq = 0;
export function nuevoId(): string {
  seq += 1;
  return `c${Date.now().toString(36)}${seq}`;
}

export function cargaDesdeSugerida(s: CargaSugerida): CargaJustificacion {
  return { id: nuevoId(), concepto: s.concepto, detalle: "", ...s.carga };
}

export function cargaLibre(): CargaJustificacion {
  return { id: nuevoId(), tipo: "CARGA", concepto: "", detalle: "", modo: "DESGLOSE", potenciaKw: null, horasDia: null, diasMes: 30, cantidad: 1 };
}

export function cargaUnificacion(): CargaJustificacion {
  return { id: nuevoId(), tipo: "UNIFICACION", concepto: "Unificación de cuenta UTE", detalle: "", modo: "DIRECTO", cuentaUte: "", potenciaContratadaKw: null, kwhMes: null };
}

// ─── Cálculo en vivo (espejo de server/.../calculo.ts, solo para mostrar) ───
// El número que vale es el del servidor: es el que va al PDF.

const nz = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function kwhMes(c: CargaJustificacion): number {
  if (c.tipo === "UNIFICACION" || c.modo === "DIRECTO") return nz(c.kwhMes);
  return nz(c.potenciaKw) * nz(c.horasDia) * nz(c.diasMes) * (c.cantidad == null ? 1 : nz(c.cantidad));
}

export function balance(d: DatosJustificacion) {
  const incrementoMensual = Math.round(d.cargas.reduce((a, c) => a + kwhMes(c), 0) * 10) / 10;
  const incrementoAnual = Math.round(incrementoMensual * 12);
  const consumoProyectado = Math.round(nz(d.consumoAnualActualKwh)) + incrementoAnual;
  const generacion = Math.round(nz(d.potenciaSolicitadaKw) * nz(d.productividadKwhKw));
  const potenciaJustificada = d.productividadKwhKw > 0 ? Math.floor((consumoProyectado / d.productividadKwhKw) * 100) / 100 : 0;
  return { incrementoMensual, incrementoAnual, consumoProyectado, generacion, potenciaJustificada, cumple: generacion <= consumoProyectado };
}

export function fmt(v: number, dec = 0): string {
  return new Intl.NumberFormat("es-UY", { maximumFractionDigits: dec }).format(v);
}
