// Datos del documento "Plan de Protección contra Granizo — Condiciones
// generales" con el Anexo A (solicitud de adhesión) completado. Mismo patrón que
// la proforma: autosave laxo (deepPartial) y publicación estricta.
//
// El texto de las condiciones es fijo (template.ts). Lo editable es lo que va en
// el Anexo A y los datos de Voltia que el documento cita en la sección 1.

import { z } from "zod";

export const planGranizoDocPublishSchema = z
  .object({
    cliente: z
      .object({
        nombre: z.string().trim().min(1, "Falta el nombre o razón social del cliente"),
        documento: z.string().trim().min(1, "Falta la C.I. o el RUT del cliente"),
        direccion: z.string().trim().min(1, "Falta la dirección de la instalación"),
        telefono: z.string().optional(),
        email: z.string().optional(),
      })
      .strict(),
    plan: z
      .object({
        cantidadPaneles: z.number().int().min(1, "Falta la cantidad de paneles"),
        precioPorPanelUsd: z.number().gt(0),
        // Anualidad = paneles × precio. Se guarda para que el PDF muestre lo mismo
        // que se firmó aunque después cambie el precio.
        anualidadUsd: z.number().gt(0),
        // NUEVA: se adhiere al contratar la obra (sin carencia). EXISTENTE: ya
        // estaba instalada (30 días de carencia y fotos de inicio).
        instalacion: z.enum(["NUEVA", "EXISTENTE"]),
        // Identifica la instalación. Puede ir vacío (la obra nueva todavía no
        // tiene inversor): queda la línea para completar a mano.
        inversorSerie: z.string().optional(),
        // Sólo instalaciones existentes: ¿se adjuntan las fotos actuales?
        fotosAdjuntas: z.boolean().nullable().optional(),
      })
      .strict(),
    // Datos de Voltia que cita la sección 1 (editables hasta cerrar el texto legal).
    empresa: z
      .object({
        razonSocial: z.string().trim().min(1),
        rut: z.string().trim().min(1, "Falta el RUT de Voltia"),
        domicilio: z.string().trim().min(1),
      })
      .strict(),
    // Fecha del documento (YYYY-MM-DD).
    fecha: z.string().min(1),
  })
  .strict();

export type PlanGranizoDocData = z.infer<typeof planGranizoDocPublishSchema>;

// Autosave: acepta cualquier cosa a medio completar (campos vacíos incluidos).
// La validación de verdad es la de publicar.
export const planGranizoDocStorageSchema = z
  .object({
    cliente: z
      .object({
        nombre: z.string(),
        documento: z.string(),
        direccion: z.string(),
        telefono: z.string(),
        email: z.string(),
      })
      .partial()
      .strict(),
    plan: z
      .object({
        cantidadPaneles: z.number().nullable(),
        precioPorPanelUsd: z.number().nullable(),
        anualidadUsd: z.number().nullable(),
        instalacion: z.enum(["NUEVA", "EXISTENTE"]),
        inversorSerie: z.string(),
        fotosAdjuntas: z.boolean().nullable(),
      })
      .partial()
      .strict(),
    empresa: z.object({ razonSocial: z.string(), rut: z.string(), domicilio: z.string() }).partial().strict(),
    fecha: z.string(),
  })
  .partial()
  .strict();

export const PLAN_GRANIZO_DOC_SNAPSHOT_VERSION = 1;
// Subirlo cuando cambie el texto de las condiciones: queda en cada versión cuál
// texto firmó el cliente.
export const PLAN_GRANIZO_DOC_TEMPLATE_VERSION = 1;

export const planGranizoDocSnapshotSchema = z
  .object({
    version: z.number(),
    templateVersion: z.number(),
    data: planGranizoDocPublishSchema,
    renderedAt: z.string(),
  })
  .strict();

export type PlanGranizoDocSnapshot = z.infer<typeof planGranizoDocSnapshotSchema>;
