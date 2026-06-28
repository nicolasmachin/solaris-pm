import { z } from "zod";

// Validadores Zod compartidos para campos de Project que se editan desde más de
// un módulo (Proyectos: create/patch · Experiencia de Clientes: PATCH inline).
// Single source of truth: el CRM NO valida distinto que Proyectos.
//
// Cada export valida el VALOR del campo; cada consumidor le agrega
// `.nullable().optional()` según corresponda.

// Email válido o "" (para limpiar el campo).
export const clientEmailValue = z.union([z.string().email("Email inválido"), z.literal("")]);

// Teléfono uruguayo: "09" + 7 dígitos, o "" para limpiar.
export const clientPhoneValue = z.union([
  z.string().regex(/^09\d{7}$/, "El teléfono debe tener formato 09 + 7 dígitos (ej. 099123456)"),
  z.literal(""),
]);

// Fecha en formato YYYY-MM-DD.
export const dateOnlyValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Debe tener formato YYYY-MM-DD");
