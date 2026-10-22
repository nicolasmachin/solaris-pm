// Qué se le factura al cliente de un proyecto.
//
// Lo define el asesor al ganar el lead (y se puede corregir en el proyecto o en
// Finanzas → Facturación):
//   - facturación normal: se factura todo el presupuesto (que es con IVA);
//   - otro monto: el monto sin IVA a facturar y el motivo (descuento, parte por
//     banco, a nombre de otro…). Monto 0 = no lleva factura.
// Proyectos anteriores al 22-oct-2026 con una nota de facturación quedan "a
// definir" (facturacionNormal null) hasta que alguien cargue el monto.

import { Prisma } from "@prisma/client";
import { z } from "zod";

export const TASA_IVA = 0.22;
const redondear = (n: number) => Math.round(n * 100) / 100;

export const facturacionSchema = z
  .object({
    normal: z.boolean(),
    sinIvaUsd: z.number().nonnegative().nullable().optional(),
    motivo: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.normal) return;
    if (f.sinIvaUsd == null) ctx.addIssue({ code: "custom", path: ["sinIvaUsd"], message: "Falta el monto a facturar" });
    if (!f.motivo || f.motivo.length < 3) ctx.addIssue({ code: "custom", path: ["motivo"], message: "Falta el motivo de la facturación distinta" });
  });

export type Facturacion = z.infer<typeof facturacionSchema>;

/** Los campos del proyecto que se guardan para una facturación definida. */
export function datosFacturacion(f: Facturacion) {
  if (f.normal) {
    // La nota es opcional acá (a nombre de quién, RUT…).
    return { facturacionNormal: true, facturarSinIvaUsd: null, llevaFactura: true, facturaNota: f.motivo || null };
  }
  const monto = redondear(f.sinIvaUsd ?? 0);
  return {
    facturacionNormal: false,
    facturarSinIvaUsd: new Prisma.Decimal(monto),
    llevaFactura: monto > 0,
    facturaNota: f.motivo ?? null,
  };
}

export type ModoFacturacion = "NORMAL" | "OTRO_MONTO" | "A_DEFINIR";

/** Cuánto hay que facturarle, sin y con IVA (null si está a definir). */
export function montoAFacturar(p: {
  facturacionNormal: boolean | null;
  facturarSinIvaUsd: Prisma.Decimal | number | null;
  budgetUsd: Prisma.Decimal | number | null;
}): { modo: ModoFacturacion; sinIva: number | null; conIva: number | null } {
  if (p.facturacionNormal === true) {
    const total = p.budgetUsd != null ? Number(p.budgetUsd) : null;
    return { modo: "NORMAL", sinIva: total != null ? redondear(total / (1 + TASA_IVA)) : null, conIva: total };
  }
  if (p.facturacionNormal === false) {
    const sinIva = Number(p.facturarSinIvaUsd ?? 0);
    return { modo: "OTRO_MONTO", sinIva: redondear(sinIva), conIva: redondear(sinIva * (1 + TASA_IVA)) };
  }
  return { modo: "A_DEFINIR", sinIva: null, conIva: null };
}
