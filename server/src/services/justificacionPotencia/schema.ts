// Forma de los datos del informe "Justificación de aumento de consumo
// eléctrico" (lo que se guarda en `JustificacionPotenciaVersion.datos`).
//
// Las cargas proyectadas son de dos tipos, igual que en los informes que
// Voltia mandaba a UTE a mano:
//   - CARGA: un consumo nuevo. Se estima desglosado (kW × h/día × días/mes ×
//     cantidad) o, cuando no hay forma razonable de desglosarlo ("aumento por
//     nueva infraestructura"), directo en kWh/mes.
//   - UNIFICACION: una cuenta UTE que se da de baja y cuyo consumo pasa a esta
//     (mudanzas, unificación de suministros). Se informa la cuenta, su potencia
//     contratada y su consumo mensual.

import { z } from "zod";

export const TIPOS_SOLICITUD = ["NUEVA", "AMPLIACION"] as const;
export type TipoSolicitud = (typeof TIPOS_SOLICITUD)[number];

// Por qué el consumo histórico de la cuenta no sirve para dimensionar. Elige
// la frase de "Antecedentes" del texto automático.
export const MOTIVOS_ANTECEDENTE = [
  "NUEVAS_CARGAS",
  "EN_CONSTRUCCION",
  "RECIEN_HABILITADO",
  "UNIFICACION",
] as const;
export type MotivoAntecedente = (typeof MOTIVOS_ANTECEDENTE)[number];

const num = (max: number) => z.number().finite().min(0).max(max);

export const cargaSchema = z
  .object({
    id: z.string().trim().min(1).max(60),
    tipo: z.enum(["CARGA", "UNIFICACION"]),
    concepto: z.string().trim().min(1).max(160),
    detalle: z.string().trim().max(600).optional().nullable(),
    // CARGA: DESGLOSE usa potencia/horas/días/cantidad; DIRECTO usa kwhMes.
    // UNIFICACION siempre usa kwhMes.
    modo: z.enum(["DESGLOSE", "DIRECTO"]).default("DESGLOSE"),
    potenciaKw: num(10_000).optional().nullable(),
    horasDia: num(24).optional().nullable(),
    diasMes: num(31).optional().nullable(),
    cantidad: num(10_000).optional().nullable(),
    kwhMes: num(10_000_000).optional().nullable(),
    // Solo UNIFICACION.
    cuentaUte: z.string().trim().max(40).optional().nullable(),
    potenciaContratadaKw: num(100_000).optional().nullable(),
  })
  .strict();
export type Carga = z.infer<typeof cargaSchema>;

export const textosSchema = z
  .object({
    objeto: z.string().max(4000).default(""),
    antecedentes: z.string().max(6000).default(""),
    justificacion: z.string().max(6000).default(""),
    conclusion: z.string().max(4000).default(""),
  })
  .strict();
export type Textos = z.infer<typeof textosSchema>;

export const datosSchema = z
  .object({
    tipoSolicitud: z.enum(TIPOS_SOLICITUD).default("NUEVA"),
    cliente: z
      .object({
        nombre: z.string().trim().min(1).max(200),
        documento: z.string().trim().max(40).default(""),
        esEmpresa: z.boolean().default(false),
        cuentaUte: z.string().trim().max(40).default(""),
        ubicacion: z.string().trim().max(300).default(""),
      })
      .strict(),
    firmante: z
      .object({
        nombre: z.string().trim().min(1).max(120),
        ci: z.string().trim().max(30).default(""),
      })
      .strict(),
    potenciaSolicitadaKw: z.number().finite().positive().max(100_000),
    // Lo que UTE contestó que "da el balance" (dato de contexto, opcional).
    potenciaUteKw: num(100_000).optional().nullable(),
    // Consumo del último año de la cuenta (lo que mira UTE). Opcional: hay
    // cuentas recién abiertas sin historia.
    consumoAnualActualKwh: num(100_000_000).optional().nullable(),
    // kWh que genera por año cada kW instalado. Uruguay ronda 1.450.
    productividadKwhKw: z.number().finite().min(500).max(2500).default(1450),
    motivoAntecedente: z.enum(MOTIVOS_ANTECEDENTE).default("NUEVAS_CARGAS"),
    cargas: z.array(cargaSchema).min(1).max(60),
    // Vacíos = se completan con el texto automático al generar.
    textos: textosSchema.default({ objeto: "", antecedentes: "", justificacion: "", conclusion: "" }),
  })
  .strict();
export type DatosJustificacion = z.infer<typeof datosSchema>;
export type DatosJustificacionInput = z.input<typeof datosSchema>;
