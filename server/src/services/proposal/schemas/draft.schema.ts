// Zod del `data` del borrador de propuesta v2. Refleja los inputs que consume
// la calculadora (Fase B) y el template (Fase C). Es el mismo shape que el
// `dataSchema` del route de preview; acá vive la versión canónica que usan el
// draft.service y el version.service. `.strict()` para atrapar drift temprano.

import { z } from "zod";

export const draftDataSchema = z
  .object({
    cliente: z
      .object({
        nombre: z.string().min(1, "Falta el nombre del cliente"),
        dirigidoA: z.string(),
        ciudad: z.string(),
      })
      .strict(),
    factura: z
      .object({
        pagaMensualPesos: z.number().min(0),
        tarifa: z.enum(["Simple", "Doble", "Triple"]),
        suministro: z.enum(["monofásico", "trifásico"]),
        potenciaContratadaKw: z.number().min(0),
      })
      .strict(),
    techo: z
      .object({
        descripcion: z.string(),
        tamanoM2: z.number().min(0),
      })
      .strict(),
    cotizacion: z
      .object({
        distanciaInstalacionKm: z.number().min(0),
        cotizacionDolar: z.number().gt(0),
        markupPorcentaje: z.number().min(0).max(1),
      })
      .strict(),
    sistema: z
      .object({
        cantidadPaneles: z.number().int().min(1),
        potenciaPanelW: z.number().min(100),
        marcaPaneles: z.string(),
        potenciaInversorKw: z.number().min(0),
        marcaInversor: z.string(),
      })
      .strict(),
    fecha: z.string().min(1),
    itemsAdicionales: z.array(
      z
        .object({
          id: z.string(),
          nombre: z.string(),
          descripcion: z.string(),
          precioSinIvaUsd: z.number().min(0),
          potenciaW: z.number().min(0).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export type DraftData = z.infer<typeof draftDataSchema>;
