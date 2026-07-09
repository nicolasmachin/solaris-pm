// Helpers puros del generador de proforma: estado inicial desde la precarga (con
// los defaults de TODOS los textos del documento), merge del borrador guardado y
// validación de obligatorios (espeja el schema strict del backend).

import type { ProformaContext, ProformaData, ProformaTextos } from "../types/proforma";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Textos por defecto del documento (los del diseño). Todos editables desde el form.
export const DEFAULT_TEXTOS: ProformaTextos = {
  tituloLinea1: "PRÉSTAMO CONSUMO CON ACUERDO",
  tituloLinea2: "DATOS DE FACTURA PROFORMA BBVA",
  headingCliente: "DATOS DEL CLIENTE",
  labelNombre: "Nombre y Apellido",
  labelCi: "CI",
  labelDireccion: "Dirección",
  labelTelefono: "Teléfono",
  labelMail: "Mail",
  labelFecha: "Fecha",
  thConcepto: "Concepto",
  thMonto: "Monto solicitado",
  thPlazo: "Plazo (meses)",
  thTasa: "Tasa en UI",
  bannerDescripcion: "Descripción del producto",
  nota: "Nota: Validez de 30 días.",
  firmante: "Ing. Nicolás Machín",
  cargo: "Director Voltia",
  footerMarca: "VOLTIA",
  footerRazonSocial: "MACHIN JUSTET NICOLAS FERNANDO",
  footerRut: "150733900014",
  footerCuentaBbva: "26754363",
  footerTel: "098 640 651",
  footerEmail: "nmachin@voltia.com.uy",
  footerWeb: "voltia.com.uy",
  footerDomicilio: "Rondeau 2110, Montevideo, Uruguay",
};

const DEFAULT_DESCRIPCION =
  "Instalación solar fotovoltaica, llave en mano, con objetos trasportables, para uso residencial.\n" +
  "Características principales:\n" +
  "• Instalación incluída.";

export function buildInitialProformaData(context: ProformaContext | undefined): ProformaData {
  const c = context?.cliente ?? {};
  return {
    cliente: {
      nombre: c.nombre ?? "",
      documento: c.documento ?? "",
      direccion: c.direccion ?? "",
      telefono: c.telefono ?? "",
      email: c.email ?? "",
    },
    financiacion: {
      concepto: "Instalación solar fotovoltaica",
      montoSolicitadoUsd: 0,
      plazoMeses: 36,
      tasaUi: 0,
    },
    descripcion: context?.descripcion ?? DEFAULT_DESCRIPCION,
    fecha: todayIso(),
    textos: { ...DEFAULT_TEXTOS },
  };
}

export function mergeProformaDraft(
  base: ProformaData,
  stored: Partial<ProformaData> | undefined | null,
): ProformaData {
  if (!stored) return base;
  return {
    cliente: { ...base.cliente, ...stored.cliente },
    financiacion: { ...base.financiacion, ...stored.financiacion },
    descripcion: stored.descripcion ?? base.descripcion,
    fecha: stored.fecha ?? base.fecha,
    textos: { ...base.textos, ...stored.textos },
  };
}

export interface MissingField {
  path: string;
  section: string;
  sectionLabel: string;
  label: string;
}

const REQUIRED: (MissingField & { ok: (d: ProformaData) => boolean })[] = [
  { path: "cliente.nombre", section: "cliente", sectionLabel: "Cliente", label: "Nombre y apellido", ok: (d) => d.cliente.nombre.trim().length > 0 },
  { path: "cliente.documento", section: "cliente", sectionLabel: "Cliente", label: "CI", ok: (d) => d.cliente.documento.trim().length > 0 },
  { path: "cliente.direccion", section: "cliente", sectionLabel: "Cliente", label: "Dirección", ok: (d) => d.cliente.direccion.trim().length > 0 },
  { path: "financiacion.concepto", section: "financiacion", sectionLabel: "Financiación", label: "Concepto", ok: (d) => d.financiacion.concepto.trim().length > 0 },
  { path: "financiacion.montoSolicitadoUsd", section: "financiacion", sectionLabel: "Financiación", label: "Monto solicitado (USD)", ok: (d) => d.financiacion.montoSolicitadoUsd > 0 },
  { path: "financiacion.plazoMeses", section: "financiacion", sectionLabel: "Financiación", label: "Plazo (meses)", ok: (d) => d.financiacion.plazoMeses >= 1 },
  { path: "descripcion", section: "descripcion", sectionLabel: "Descripción", label: "Descripción del producto", ok: (d) => d.descripcion.trim().length > 0 },
  { path: "fecha", section: "financiacion", sectionLabel: "Financiación", label: "Fecha", ok: (d) => d.fecha.trim().length > 0 },
];

export function validateProforma(d: ProformaData): { ok: boolean; missing: MissingField[] } {
  const missing = REQUIRED.filter((r) => !r.ok(d)).map(({ ok: _ok, ...rest }) => rest);
  return { ok: missing.length === 0, missing };
}

export function proformaPdfFilename(clientName: string | null | undefined, versionNumber: number): string {
  const clean = (clientName ?? "").replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "Cliente";
  return `Proforma BBVA Voltia - ${clean} - V${versionNumber}.pdf`;
}
