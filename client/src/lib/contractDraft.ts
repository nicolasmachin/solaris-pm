// Helpers puros del generador de contrato: armar el estado inicial del form desde
// la precarga del backend (context), mergear el borrador guardado (parcial), y
// validar los obligatorios (espeja contractDataPublishSchema del backend).

import type { ContractContext, ContractData } from "../types/contract";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Base + overlay de la precarga (context). Lo que el context no traiga toma el
// default (o queda vacío para completar a mano).
export function buildInitialContractData(context: ContractContext | undefined): ContractData {
  const c = context?.cliente ?? {};
  const inst = context?.instalacion ?? {};
  const s = context?.sistema ?? {};
  const co = context?.comercial ?? {};
  return {
    cliente: {
      nombre: c.nombre ?? "",
      documento: c.documento ?? "",
    },
    instalacion: {
      direccion: inst.direccion ?? "",
      ciudad: inst.ciudad ?? "",
      departamento: inst.departamento ?? "",
    },
    sistema: {
      cantidadPaneles: s.cantidadPaneles ?? 0,
      potenciaUnitariaWp: s.potenciaUnitariaWp ?? 580,
      potenciaTotalKwp: s.potenciaTotalKwp ?? 0,
      marcaPaneles: s.marcaPaneles ?? "Resun",
      cantidadInversores: s.cantidadInversores ?? 1,
      potenciaInversorKw: s.potenciaInversorKw ?? 0,
      marcaInversor: s.marcaInversor ?? "",
      tipoTecho: s.tipoTecho ?? "",
      generacionAnualKwh: s.generacionAnualKwh ?? 0,
    },
    comercial: {
      precioTotalUsd: co.precioTotalUsd ?? 0,
    },
    contrato: {
      lugar: "Montevideo",
      fecha: todayIso(),
      fechaInicioObra: "",
    },
    notas: "",
  };
}

// Mergea el borrador guardado (parcial, lenient) sobre la base inicial.
export function mergeContractDraft(
  base: ContractData,
  stored: Partial<ContractData> | undefined | null,
): ContractData {
  if (!stored) return base;
  return {
    cliente: { ...base.cliente, ...stored.cliente },
    instalacion: { ...base.instalacion, ...stored.instalacion },
    sistema: { ...base.sistema, ...stored.sistema },
    comercial: { ...base.comercial, ...stored.comercial },
    contrato: { ...base.contrato, ...stored.contrato },
    notas: stored.notas ?? base.notas,
  };
}

// ─── Validación de obligatorios (espeja contractDataPublishSchema) ───────────

export interface MissingField {
  path: string;
  section: string;
  sectionLabel: string;
  label: string;
}

const REQUIRED: (MissingField & { ok: (d: ContractData) => boolean })[] = [
  { path: "cliente.nombre", section: "cliente", sectionLabel: "Cliente", label: "Nombre del cliente", ok: (d) => d.cliente.nombre.trim().length > 0 },
  { path: "cliente.documento", section: "cliente", sectionLabel: "Cliente", label: "Documento de identidad", ok: (d) => d.cliente.documento.trim().length > 0 },
  { path: "instalacion.direccion", section: "instalacion", sectionLabel: "Inmueble", label: "Dirección", ok: (d) => d.instalacion.direccion.trim().length > 0 },
  { path: "instalacion.ciudad", section: "instalacion", sectionLabel: "Inmueble", label: "Ciudad", ok: (d) => d.instalacion.ciudad.trim().length > 0 },
  { path: "instalacion.departamento", section: "instalacion", sectionLabel: "Inmueble", label: "Departamento", ok: (d) => d.instalacion.departamento.trim().length > 0 },
  { path: "sistema.cantidadPaneles", section: "sistema", sectionLabel: "Sistema", label: "Cantidad de paneles", ok: (d) => d.sistema.cantidadPaneles >= 1 },
  { path: "sistema.potenciaUnitariaWp", section: "sistema", sectionLabel: "Sistema", label: "Potencia por panel (Wp)", ok: (d) => d.sistema.potenciaUnitariaWp >= 1 },
  { path: "sistema.marcaPaneles", section: "sistema", sectionLabel: "Sistema", label: "Marca de paneles", ok: (d) => d.sistema.marcaPaneles.trim().length > 0 },
  { path: "sistema.cantidadInversores", section: "sistema", sectionLabel: "Sistema", label: "Cantidad de inversores", ok: (d) => d.sistema.cantidadInversores >= 1 },
  { path: "sistema.marcaInversor", section: "sistema", sectionLabel: "Sistema", label: "Marca de inversor", ok: (d) => d.sistema.marcaInversor.trim().length > 0 },
  { path: "sistema.tipoTecho", section: "sistema", sectionLabel: "Sistema", label: "Tipo de techo", ok: (d) => d.sistema.tipoTecho.trim().length > 0 },
  { path: "contrato.lugar", section: "contrato", sectionLabel: "Contrato", label: "Lugar", ok: (d) => d.contrato.lugar.trim().length > 0 },
  { path: "contrato.fecha", section: "contrato", sectionLabel: "Contrato", label: "Fecha", ok: (d) => d.contrato.fecha.trim().length > 0 },
];

export function validateContract(d: ContractData): { ok: boolean; missing: MissingField[] } {
  const missing = REQUIRED.filter((r) => !r.ok(d)).map(({ ok: _ok, ...rest }) => rest);
  return { ok: missing.length === 0, missing };
}

// Nombre del archivo descargado: "Contrato Voltia - {cliente} - V{n}.pdf".
export function contractPdfFilename(clientName: string | null | undefined, versionNumber: number): string {
  const clean = (clientName ?? "").replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "Cliente";
  return `Contrato Voltia - ${clean} - V${versionNumber}.pdf`;
}
