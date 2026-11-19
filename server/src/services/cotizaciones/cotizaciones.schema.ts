// Validación de las cotizaciones a medida y de los artículos de venta.

import { z } from "zod";

const texto = (max: number) => z.string().max(max).nullable().optional();

/** Un renglón del detalle: un ítem con precio o un título de sección. */
export const renglonSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("item"),
    descripcion: z.string().max(200),
    detalle: z.string().max(1500).nullable().optional(),
    cantidad: z.number().min(0).max(1_000_000),
    unidad: z.string().max(20).nullable().optional(),
    precioUnitario: z.number().min(0).max(100_000_000),
    articuloId: z.string().nullable().optional(),
  }),
  z.object({
    tipo: z.literal("seccion"),
    descripcion: z.string().max(200),
  }),
]);
export type Renglon = z.infer<typeof renglonSchema>;

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Lo que se edita en el constructor (todo menos número, estado y para quién). */
export const contenidoSchema = z.object({
  clienteNombre: z.string().trim().min(1, "El cliente necesita un nombre").max(160),
  clienteDireccion: texto(240),
  clienteCiudad: texto(120),
  clienteTelefono: texto(60),
  clienteEmail: texto(160),
  fecha: fechaIso,
  validaHasta: fechaIso,
  moneda: z.enum(["USD", "UYU"]),
  vendedorId: z.string().nullable().optional(),
  formaTrabajo: texto(80),
  alcanceTitulo: texto(80),
  alcanceTexto: texto(3000),
  items: z.array(renglonSchema).max(80),
  ivaTasa: z.number().min(0).max(100),
  condicionesPago: texto(600),
  plazoEntrega: texto(600),
  incluye: texto(2000),
  noIncluye: texto(2000),
  observaciones: texto(2000),
});
export type Contenido = z.infer<typeof contenidoSchema>;

/** Para quién es: al menos uno, o un cliente nuevo que se crea como contacto. */
export const destinoSchema = z.object({
  leadId: z.string().nullable().optional(),
  contactoId: z.string().nullable().optional(),
  empresaId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  clienteNuevo: z
    .object({ nombre: z.string().trim().min(1).max(120), telefono: texto(40), email: texto(160) })
    .nullable()
    .optional(),
});
export type Destino = z.infer<typeof destinoSchema>;

export const cotizacionBody = contenidoSchema.merge(destinoSchema);
export const estadoBody = z.object({ estado: z.enum(["BORRADOR", "ENVIADA", "ACEPTADA", "RECHAZADA"]) });

export const articuloBody = z.object({
  nombre: z.string().trim().min(1).max(200),
  detalle: texto(1500),
  unidad: z.string().trim().min(1).max(20),
  precio: z.number().min(0).max(100_000_000),
  moneda: z.enum(["USD", "UYU"]),
  activo: z.boolean().optional(),
});
