// Lógica pura de las herramientas de propuesta del conector: qué cotizador usar
// y cómo se aplican los datos de la empresa al borrador. Aparte para poder
// probarla sin base ni servidor MCP.

import { ProposalVariante } from "@prisma/client";

import { saludoDePropuesta } from "../../../services/proposal/salutation.js";
import type { DraftDataPublish } from "../../../services/proposal/schemas/draft.schema.js";

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
