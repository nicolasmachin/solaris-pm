// Schemas del `data` del borrador de contrato (subetapa Contrato del onboarding).
//
// Split save-lenient / publish-strict (mismo patrón que propuestas v2):
//   - contractDataStorageSchema (LENIENT): PUT /contract/draft (autosave).
//   - contractDataPublishSchema (STRICT): publish, preview del borrador y
//     validateContract (cliente). FUENTE DE VERDAD de los campos obligatorios.
//
// Los campos espejan las variables del contrato real de Voltia (encabezado +
// cliente + inmueble + detalle técnico/económico). Los datos fijos de la Empresa y
// las cláusulas invariables viven en el template.

import { z } from "zod";

export const contractDataPublishSchema = z
  .object({
    cliente: z
      .object({
        nombre: z.string().min(1, "Falta el nombre del cliente"),
        documento: z.string().min(1, "Falta el documento de identidad"),
      })
      .strict(),
    instalacion: z
      .object({
        direccion: z.string().min(1, "Falta la dirección del inmueble"),
        ciudad: z.string().min(1, "Falta la ciudad"),
        departamento: z.string().min(1, "Falta el departamento"),
      })
      .strict(),
    sistema: z
      .object({
        cantidadPaneles: z.number().int().min(1),
        potenciaUnitariaWp: z.number().min(1),
        potenciaTotalKwp: z.number().min(0),
        marcaPaneles: z.string().min(1),
        cantidadInversores: z.number().int().min(1),
        potenciaInversorKw: z.number().min(0),
        marcaInversor: z.string().min(1),
        tipoTecho: z.string().min(1),
        generacionAnualKwh: z.number().min(0),
      })
      .strict(),
    comercial: z
      .object({
        precioTotalUsd: z.number().min(0),
      })
      .strict(),
    contrato: z
      .object({
        lugar: z.string().min(1),
        fecha: z.string().min(1),
        // Fecha tentativa de inicio de obra (cláusula 12). Opcional.
        fechaInicioObra: z.string().optional(),
      })
      .strict(),
    notas: z.string().optional(),
  })
  .strict();

export type ContractDataPublish = z.infer<typeof contractDataPublishSchema>;

// Versión lenient para el autosave: todo opcional (recursivo).
export const contractDataStorageSchema = contractDataPublishSchema.deepPartial();

export type ContractDataStorage = z.infer<typeof contractDataStorageSchema>;
