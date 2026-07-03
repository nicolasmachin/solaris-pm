// Schemas del `data` del borrador de propuesta v2.
//
// Split save-lenient / publish-strict (Fase F):
//   - draftDataStorageSchema (LENIENT): lo usa PUT /draft (autosave). Permite
//     borradores a medio llenar; sólo valida tipos de lo presente y rechaza keys
//     desconocidas. El asesor nunca pierde trabajo por campos faltantes.
//   - draftDataPublishSchema (STRICT): lo usan publish (POST /versions), el
//     preview del borrador y validateDraft (cliente). Es la FUENTE DE VERDAD de
//     los campos obligatorios.
//
// snapshot.data se valida con el STRICT al PUBLICAR. Al LEER un snapshot viejo
// (regenerate) no se re-valida "por las dudas": si falla es porque se agregaron
// campos obligatorios después, y esa versión queda no-regenerable con mensaje
// claro (ver version.service.regeneratePdf).

import { z } from "zod";

const itemAdicionalSchema = z
  .object({
    id: z.string(),
    nombre: z.string(),
    descripcion: z.string(),
    precioSinIvaUsd: z.number().min(0),
    potenciaW: z.number().min(0).optional(),
  })
  .strict();

export const draftDataPublishSchema = z
  .object({
    cliente: z
      .object({
        nombre: z.string().min(1, "Falta el nombre del cliente"),
        dirigidoA: z.string().optional(),
        ciudad: z.string().min(1, "Falta la ciudad"),
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
        descripcion: z.string().min(1),
        tamanoM2: z.number().min(0),
      })
      .strict(),
    cotizacion: z
      .object({
        distanciaInstalacionKm: z.number().min(0),
        cotizacionDolar: z.number().gt(0),
        // Acepta decimal (0.2) o porcentaje (20); la calc lo interpreta por magnitud.
        markupPorcentaje: z.number().min(0).max(100),
        // Plazo de entrega (Fase F): precargado de ProposalDefaults.plazos al
        // crear el draft; obligatorio para publicar.
        plazoEntrega: z.string().min(1),
      })
      .strict(),
    sistema: z
      .object({
        cantidadPaneles: z.number().int().min(1),
        potenciaPanelW: z.number().min(100),
        marcaPaneles: z.string().min(1),
        potenciaInversorKw: z.number().min(0),
        marcaInversor: z.string().min(1),
        // Tipo de montaje (Fase F): string libre por ahora ("Techo chapa", …).
        tipoMontaje: z.string().min(1),
      })
      .strict(),
    fecha: z.string().min(1),
    notas: z.string().optional(),
    itemsAdicionales: z.array(itemAdicionalSchema),
  })
  .strict();

export type DraftDataPublish = z.infer<typeof draftDataPublishSchema>;

// Versión lenient para el autosave: todo opcional (recursivo). Valida tipos de
// lo que venga; permite parciales.
export const draftDataStorageSchema = draftDataPublishSchema.deepPartial();

export type DraftDataStorage = z.infer<typeof draftDataStorageSchema>;
