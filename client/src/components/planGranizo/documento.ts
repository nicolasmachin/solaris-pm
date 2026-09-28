// Estado inicial, merge y validación del documento del plan (espeja el schema
// estricto del backend: services/seguro-granizo/documento/schema.ts).

import type { PlanGranizoDocContext, PlanGranizoDocData } from "../../api/planGranizo.api";
import type { MissingField } from "../../lib/proposalDraft";
import { hoyIso } from "./estado";

export function redondear(n: number) {
  return Math.round(n * 100) / 100;
}

export function buildInitialDocData(ctx: PlanGranizoDocContext | undefined): PlanGranizoDocData {
  const paneles = ctx?.plan.cantidadPaneles ?? 0;
  const precio = ctx?.plan.precioPorPanelUsd ?? 12;
  return {
    cliente: {
      nombre: ctx?.cliente.nombre ?? "",
      documento: ctx?.cliente.documento ?? "",
      direccion: ctx?.cliente.direccion ?? "",
      telefono: ctx?.cliente.telefono ?? "",
      email: ctx?.cliente.email ?? "",
    },
    plan: {
      cantidadPaneles: paneles,
      precioPorPanelUsd: precio,
      anualidadUsd: redondear(paneles * precio),
      instalacion: ctx?.plan.instalacion ?? "NUEVA",
      inversorSerie: ctx?.plan.inversorSerie ?? "",
      fotosAdjuntas: ctx?.plan.fotosAdjuntas ?? null,
    },
    empresa: ctx?.empresa ?? { razonSocial: "Voltia SAS", rut: "221075240012", domicilio: "Av. Gral. Rondeau 2110, Montevideo" },
    fecha: hoyIso(),
  };
}

export function mergeDocDraft(base: PlanGranizoDocData, stored: Partial<PlanGranizoDocData> | undefined | null): PlanGranizoDocData {
  if (!stored) return base;
  return {
    cliente: { ...base.cliente, ...stored.cliente },
    plan: { ...base.plan, ...stored.plan },
    empresa: { ...base.empresa, ...stored.empresa },
    fecha: stored.fecha ?? base.fecha,
  };
}

const REQUIRED: (MissingField & { ok: (d: PlanGranizoDocData) => boolean })[] = [
  { path: "cliente.nombre", section: "cliente", sectionLabel: "Cliente", label: "Nombre o razón social", ok: (d) => d.cliente.nombre.trim().length > 0 },
  { path: "cliente.documento", section: "cliente", sectionLabel: "Cliente", label: "C.I. / RUT", ok: (d) => d.cliente.documento.trim().length > 0 },
  { path: "cliente.direccion", section: "cliente", sectionLabel: "Cliente", label: "Dirección de la instalación", ok: (d) => d.cliente.direccion.trim().length > 0 },
  { path: "plan.cantidadPaneles", section: "plan", sectionLabel: "Plan", label: "Cantidad de paneles", ok: (d) => Number.isInteger(d.plan.cantidadPaneles) && d.plan.cantidadPaneles >= 1 },
  { path: "plan.precioPorPanelUsd", section: "plan", sectionLabel: "Plan", label: "Precio por panel", ok: (d) => d.plan.precioPorPanelUsd > 0 },
  { path: "empresa.rut", section: "empresa", sectionLabel: "Voltia", label: "RUT de Voltia", ok: (d) => d.empresa.rut.trim().length > 0 },
  { path: "empresa.razonSocial", section: "empresa", sectionLabel: "Voltia", label: "Razón social", ok: (d) => d.empresa.razonSocial.trim().length > 0 },
  { path: "empresa.domicilio", section: "empresa", sectionLabel: "Voltia", label: "Domicilio fiscal", ok: (d) => d.empresa.domicilio.trim().length > 0 },
];

export function validateDoc(d: PlanGranizoDocData): { ok: boolean; missing: MissingField[] } {
  const missing = REQUIRED.filter((r) => !r.ok(d)).map(({ ok: _ok, ...rest }) => rest);
  return { ok: missing.length === 0, missing };
}

export function docPdfFilename(clientName: string | null | undefined, versionNumber: number) {
  const limpio = (clientName ?? "").replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "Cliente";
  return `Plan de Protección contra Granizo - ${limpio} - V${versionNumber}.pdf`;
}
