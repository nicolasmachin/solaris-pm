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

// Base sin refinamientos: de acá salen las DOS variantes. No mergear el
// superRefine de abajo en este objeto — `.superRefine()` devuelve un ZodEffects
// y ZodEffects no tiene `.deepPartial()`, así que el autosave dejaría de
// compilar (y de aceptar borradores a medio llenar).
const draftDataBaseSchema = z
  .object({
    // Variante del documento. Con default a propósito: los snapshots publicados
    // antes de B2B no la traen, y si fuera obligatoria todos quedarían
    // no-regenerables (ver regeneratePdf). Zod la completa como RESIDENCIAL.
    variante: z.enum(["RESIDENCIAL", "EMPRESA"]).default("RESIDENCIAL"),
    cliente: z
      .object({
        nombre: z.string().min(1, "Falta el nombre del cliente"),
        dirigidoA: z.string().optional(),
        ciudad: z.string().min(1, "Falta la ciudad"),
      })
      .strict(),
    // Datos fiscales del cliente empresa. Opcional en el objeto base y exigido
    // por el refinamiento solo cuando la variante es EMPRESA.
    empresa: z
      .object({
        razonSocial: z.string(),
        rut: z.string(),
        contactoNombre: z.string().optional(),
        contactoCargo: z.string().optional(),
      })
      .strict()
      .optional(),
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

// Los `path` de estos issues los consume draftMissingFields() para armar la
// lista de "qué falta para publicar" del botón Publicar.
export const draftDataPublishSchema = draftDataBaseSchema.superRefine((data, ctx) => {
  if (data.variante !== "EMPRESA") return;
  if (!data.empresa?.razonSocial?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["empresa", "razonSocial"],
      message: "Falta la razón social",
    });
  }
  // Solo se exige que esté: el RUT se escribe con y sin puntos y un regex
  // estricto acá es una forma barata de bloquear una venta.
  if (!data.empresa?.rut?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["empresa", "rut"],
      message: "Falta el RUT",
    });
  }
});

export type DraftDataPublish = z.infer<typeof draftDataPublishSchema>;

// Versión lenient para el autosave: además de hacer todo opcional, saca las
// restricciones de "campo completo".
//
// No se puede derivar con `draftDataBaseSchema.deepPartial()`: eso hace las
// claves opcionales pero conserva los `.min(1)`, así que un borrador recién
// abierto —con la ciudad vacía y 0 paneles, que es exactamente su estado
// inicial— era rechazado con 400 y el autosave quedaba en error hasta que el
// asesor completaba esos campos. El comentario de arriba siempre dijo "sólo
// valida tipos de lo presente"; esto es lo que hace falta para que sea cierto.
//
// Se conservan los enums y los `.min(0)`: un valor negativo o una tarifa
// inexistente no son un borrador a medio llenar, son un error.
const itemAdicionalLenientSchema = z
  .object({
    id: z.string(),
    nombre: z.string(),
    descripcion: z.string(),
    precioSinIvaUsd: z.number().min(0),
    potenciaW: z.number().min(0).optional(),
  })
  .strict();

export const draftDataStorageSchema = z
  .object({
    variante: z.enum(["RESIDENCIAL", "EMPRESA"]).optional(),
    cliente: z
      .object({
        nombre: z.string(),
        dirigidoA: z.string(),
        ciudad: z.string(),
      })
      .strict()
      .deepPartial(),
    empresa: z
      .object({
        razonSocial: z.string(),
        rut: z.string(),
        contactoNombre: z.string(),
        contactoCargo: z.string(),
      })
      .strict()
      .deepPartial(),
    factura: z
      .object({
        pagaMensualPesos: z.number().min(0),
        tarifa: z.enum(["Simple", "Doble", "Triple"]),
        suministro: z.enum(["monofásico", "trifásico"]),
        potenciaContratadaKw: z.number().min(0),
      })
      .strict()
      .deepPartial(),
    techo: z
      .object({
        descripcion: z.string(),
        tamanoM2: z.number().min(0),
      })
      .strict()
      .deepPartial(),
    cotizacion: z
      .object({
        distanciaInstalacionKm: z.number().min(0),
        cotizacionDolar: z.number().min(0),
        markupPorcentaje: z.number().min(0).max(100),
        plazoEntrega: z.string(),
      })
      .strict()
      .deepPartial(),
    sistema: z
      .object({
        cantidadPaneles: z.number().int().min(0),
        potenciaPanelW: z.number().min(0),
        marcaPaneles: z.string(),
        potenciaInversorKw: z.number().min(0),
        marcaInversor: z.string(),
        tipoMontaje: z.string(),
      })
      .strict()
      .deepPartial(),
    fecha: z.string(),
    notas: z.string(),
    itemsAdicionales: z.array(itemAdicionalLenientSchema),
  })
  .strict()
  .partial();

export type DraftDataStorage = z.infer<typeof draftDataStorageSchema>;
