// Schemas del `data` del borrador de proforma BBVA. Split save-lenient /
// publish-strict. TODO el texto del documento es editable: además de los valores
// (cliente, montos, descripción), el objeto `textos` contiene cada rótulo, título,
// header de tabla, dato del pie y firma, con sus valores por defecto en el cliente.

import { z } from "zod";

// Cada texto del documento es un string libre (puede quedar vacío). Los defaults
// viven en el cliente (buildInitialProformaData).
const textosSchema = z
  .object({
    tituloLinea1: z.string(),
    tituloLinea2: z.string(),
    headingCliente: z.string(),
    labelNombre: z.string(),
    labelCi: z.string(),
    labelDireccion: z.string(),
    labelTelefono: z.string(),
    labelMail: z.string(),
    labelFecha: z.string(),
    thConcepto: z.string(),
    thMonto: z.string(),
    thPlazo: z.string(),
    thTasa: z.string(),
    bannerDescripcion: z.string(),
    nota: z.string(),
    firmante: z.string(),
    cargo: z.string(),
    footerMarca: z.string(),
    footerRazonSocial: z.string(),
    footerRut: z.string(),
    footerCuentaBbva: z.string(),
    footerTel: z.string(),
    footerEmail: z.string(),
    footerWeb: z.string(),
    footerDomicilio: z.string(),
  })
  .strict();

export const proformaDataPublishSchema = z
  .object({
    cliente: z
      .object({
        nombre: z.string().min(1, "Falta el nombre del cliente"),
        documento: z.string().min(1, "Falta el documento (CI)"),
        direccion: z.string().min(1, "Falta la dirección"),
        telefono: z.string().optional(),
        email: z.string().optional(),
      })
      .strict(),
    financiacion: z
      .object({
        concepto: z.string().min(1),
        // Monto solicitado al banco (se carga a mano). Debe ser > 0 para publicar.
        montoSolicitadoUsd: z.number().gt(0),
        plazoMeses: z.number().int().min(1),
        tasaUi: z.number().min(0),
      })
      .strict(),
    // Descripción del producto (texto libre multilínea; las líneas con "• " se
    // muestran como viñetas). Se precarga con el detalle del sistema.
    descripcion: z.string().min(1),
    fecha: z.string().min(1),
    textos: textosSchema,
  })
  .strict();

export type ProformaDataPublish = z.infer<typeof proformaDataPublishSchema>;

export const proformaDataStorageSchema = proformaDataPublishSchema.deepPartial();

export type ProformaDataStorage = z.infer<typeof proformaDataStorageSchema>;
