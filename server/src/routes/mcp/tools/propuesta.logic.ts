// Lógica pura de las herramientas de propuesta del conector: qué cotizador usar
// y cómo se aplican los datos de la empresa al borrador. Aparte para poder
// probarla sin base ni servidor MCP.

import { ProposalVariante } from "@prisma/client";

import { saludoDePropuesta } from "../../../services/proposal/salutation.js";
import type { CostosOverride, DraftDataPublish } from "../../../services/proposal/schemas/draft.schema.js";
import type { ProposalCalculated } from "../../../services/proposal/types.js";

export type TipoPropuesta = "residencial" | "empresa";

/**
 * El cotizador a usar: el que se pidió o, si no se dijo, el del tipo de cliente
 * del lead. Así un lead cargado como empresa no termina con una propuesta
 * residencial porque nadie aclaró el tipo en el chat.
 */
export function elegirVariante(
  tipo: TipoPropuesta | undefined,
  tipoClienteLead: ProposalVariante | null | undefined,
): ProposalVariante {
  if (tipo === "empresa") return ProposalVariante.EMPRESA;
  if (tipo === "residencial") return ProposalVariante.RESIDENCIAL;
  return tipoClienteLead === ProposalVariante.EMPRESA ? ProposalVariante.EMPRESA : ProposalVariante.RESIDENCIAL;
}

export type DatosEmpresa = {
  razon_social?: string;
  rut?: string;
  contacto_nombre?: string;
  contacto_cargo?: string;
};

/**
 * Aplica los datos de la empresa (solo en B2B) y recalcula el saludo de la
 * carta, que en B2B sale del contacto. Devuelve el borrador nuevo sin tocar el
 * original.
 */
export function aplicarEmpresa(data: DraftDataPublish, d: DatosEmpresa): DraftDataPublish {
  const actual = data.empresa ?? { razonSocial: "", rut: "", contactoNombre: "", contactoCargo: "" };
  const empresa =
    data.variante === "EMPRESA"
      ? {
          ...actual,
          ...(d.razon_social !== undefined && { razonSocial: d.razon_social.trim() }),
          ...(d.rut !== undefined && { rut: d.rut.trim() }),
          ...(d.contacto_nombre !== undefined && { contactoNombre: d.contacto_nombre.trim() }),
          ...(d.contacto_cargo !== undefined && { contactoCargo: d.contacto_cargo.trim() }),
        }
      : data.empresa;
  return {
    ...data,
    ...(empresa && { empresa }),
    cliente: {
      ...data.cliente,
      dirigidoA: saludoDePropuesta(data.variante, data.cliente.nombre, empresa?.contactoNombre),
    },
  };
}

/** Si vino algún dato de empresa: para avisar que se ignoró en una residencial. */
export function vinoAlgoDeEmpresa(d: DatosEmpresa): boolean {
  return [d.razon_social, d.rut, d.contacto_nombre, d.contacto_cargo].some((v) => v !== undefined);
}

// ── Costeo de la cotización ─────────────────────────────────────────────────
// Lo mismo que el panel "Costeo" del cotizador: cada costo se puede pisar solo
// para esta propuesta. Vacío (null) vuelve al valor de fábrica.

/** Ajuste del costeo tal como llega del conector: número, null (volver al original) o nada. */
export type AjustesCosteoPedido = Partial<Record<CampoCosteo, number | null>>;

/** Nombres del conector → claves del borrador, en el orden de la planilla. */
export const CAMPOS_COSTEO = {
  paneles_costo_unitario_usd: "panelPrecioUnitario",
  paneles_cantidad: "panelCantidad",
  estructura_costo_unitario_usd: "estructuraPrecioUnitario",
  estructura_cantidad: "estructuraCantidad",
  electrica_costo_unitario_usd: "electricaPrecioUnitario",
  electrica_cantidad: "electricaCantidad",
  inversor_costo_unitario_usd: "inversorPrecioUnitario",
  inversor_cantidad: "inversorCantidad",
  meter_costo_unitario_usd: "meterPrecioUnitario",
  meter_cantidad: "meterCantidad",
  costos_fijos_usd: "costoFijoAsignado",
  costos_variables_usd: "costoVariable",
  mano_de_obra_usd: "manoDeObra",
  comision_vendedor_usd: "comisionVentas",
  comision_bbva_usd: "comisionBbva",
} as const satisfies Record<string, keyof CostosOverride>;

export type CampoCosteo = keyof typeof CAMPOS_COSTEO;

/**
 * Aplica los ajustes pedidos sobre los que ya tiene el borrador. `restablecer`
 * borra todos antes (como "Volver todo a los valores originales"). Devuelve
 * undefined si no queda ninguno, para que el borrador no guarde un objeto vacío.
 */
export function aplicarAjustesCosteo(
  actual: CostosOverride | undefined,
  pedido: AjustesCosteoPedido,
  restablecer = false,
): CostosOverride | undefined {
  const costos: CostosOverride = restablecer ? {} : { ...(actual ?? {}) };
  for (const [campo, clave] of Object.entries(CAMPOS_COSTEO) as [CampoCosteo, keyof CostosOverride][]) {
    const valor = pedido[campo];
    if (valor === undefined) continue;
    if (valor === null) delete costos[clave];
    else costos[clave] = valor;
  }
  return Object.keys(costos).length > 0 ? costos : undefined;
}

/** Si el pedido trae algo del costeo (para saber si hay que tocar el borrador). */
export function vinoAlgoDeCosteo(pedido: AjustesCosteoPedido, restablecer = false): boolean {
  return restablecer || Object.values(pedido).some((v) => v !== undefined);
}

const NOMBRE_AJUSTE: Record<keyof CostosOverride, string> = {
  panelPrecioUnitario: "Paneles, costo por unidad",
  panelCantidad: "Paneles, cantidad",
  estructuraPrecioUnitario: "Estructuras, costo por unidad",
  estructuraCantidad: "Estructuras, cantidad",
  electricaPrecioUnitario: "Eléctrica, costo por unidad",
  electricaCantidad: "Eléctrica, cantidad",
  inversorPrecioUnitario: "Inversor, costo por unidad",
  inversorCantidad: "Inversor, cantidad",
  meterPrecioUnitario: "Meter, costo por unidad",
  meterCantidad: "Meter, cantidad",
  costoFijoAsignado: "Costos fijos",
  costoVariable: "Costos variables",
  manoDeObra: "Mano de obra",
  comisionVentas: "Comisión del asesor",
  comisionBbva: "Comisión BBVA",
};

const ES_CANTIDAD = new Set<keyof CostosOverride>([
  "panelCantidad",
  "estructuraCantidad",
  "electricaCantidad",
  "inversorCantidad",
  "meterCantidad",
]);

/** Los ajustes cargados, como [nombre, valor] para el bloque de lo cargado. */
export function ajustesComoCampos(
  costos: CostosOverride | undefined,
  usd: (n: number) => string,
): [string, string][] {
  if (!costos) return [];
  return (Object.keys(NOMBRE_AJUSTE) as (keyof CostosOverride)[])
    .filter((k) => costos[k] !== undefined)
    .map((k) => [
      `${NOMBRE_AJUSTE[k]} (fijado a mano)`,
      ES_CANTIDAD.has(k) ? String(costos[k]) : usd(costos[k]!),
    ]);
}

type CalcCosteo = Pick<
  ProposalCalculated,
  | "panelPrecioUnitario"
  | "panelCantidad"
  | "estructuraPrecioUnitario"
  | "estructuraCantidad"
  | "electricaPrecioUnitario"
  | "electricaCantidad"
  | "inversorPrecioUnitario"
  | "inversorCantidad"
  | "meterPrecioUnitario"
  | "meterCantidad"
  | "costoEquipamientoSinIva"
  | "costoFijoAsignadoUsdSinIva"
  | "costoVariableUsdSinIva"
  | "manoDeObraUsdSinIva"
  | "comisionVentasUsdSinIva"
  | "comisionBbvaUsdSinIva"
>;

/**
 * La tabla del costeo en filas de texto, en USD sin IVA. Cada línea pisada a
 * mano dice cuánto valía de fábrica, como el panel del cotizador.
 */
export function lineasCosteo(
  calc: CalcCosteo,
  fabrica: CalcCosteo,
  ajustes: CostosOverride,
  usd: (n: number) => string,
): [string, string][] {
  const marca = (pisado: boolean, original: string) => (pisado ? ` — fijado a mano, de fábrica ${original}` : "");
  const items = [
    ["Paneles", "panel"],
    ["Estructuras", "estructura"],
    ["Eléctrica", "electrica"],
    ["Inversor", "inversor"],
    ["Meter", "meter"],
  ] as const;
  const filas: [string, string][] = items.map(([nombre, k]) => {
    const kp = `${k}PrecioUnitario` as const;
    const kc = `${k}Cantidad` as const;
    const p = calc[kp];
    const c = calc[kc];
    const pisado = ajustes[kp] !== undefined || ajustes[kc] !== undefined;
    return [
      nombre,
      `${c} × ${usd(p)} = ${usd(p * c)}` + marca(pisado, `${fabrica[kc]} × ${usd(fabrica[kp])}`),
    ];
  });
  const bloque = (
    nombre: string,
    k: keyof CostosOverride,
    v: number,
    f: number,
  ): [string, string] => [nombre, usd(v) + marca(ajustes[k] !== undefined, usd(f))];
  const comision = (nombre: string, k: keyof CostosOverride, v: number): [string, string] => [
    nombre,
    usd(v) + (ajustes[k] !== undefined ? " — fijada a mano" : ""),
  ];
  return [
    ...filas,
    ["Equipamiento", usd(calc.costoEquipamientoSinIva)],
    bloque("Costos fijos", "costoFijoAsignado", calc.costoFijoAsignadoUsdSinIva, fabrica.costoFijoAsignadoUsdSinIva),
    bloque("Costos variables", "costoVariable", calc.costoVariableUsdSinIva, fabrica.costoVariableUsdSinIva),
    bloque("Mano de obra", "manoDeObra", calc.manoDeObraUsdSinIva, fabrica.manoDeObraUsdSinIva),
    // Las comisiones son un porcentaje sobre los demás costos: el valor "de
    // fábrica" (sin ningún ajuste) no es el que corresponde si se pisó otra
    // línea, así que solo se marca que están fijadas.
    comision("Comisión del asesor", "comisionVentas", calc.comisionVentasUsdSinIva),
    comision("Comisión BBVA", "comisionBbva", calc.comisionBbvaUsdSinIva),
  ];
}
