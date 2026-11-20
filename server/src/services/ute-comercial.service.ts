// Trámites con UTE Comercial: aumentos de potencia, suministros nuevos,
// reducciones, provisorios… Todo lo que se le pide a UTE Comercial y no es la
// habilitación del generador. Viven aparte de `UteProcess` (ver el comentario
// del modelo `UteTramiteComercial` en el schema).

import { UteTramiteComercialEstado, UteTramiteComercialTipo } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { hoyUruguay } from "../utils/uruguay.js";

/** Rótulo de cada tipo, como lo dice el formulario de UTE. */
export const TIPO_LABEL: Record<UteTramiteComercialTipo, string> = {
  NUEVO_SERVICIO: "Nuevo servicio",
  AUMENTO: "Aumento de potencia",
  REDUCCION: "Reducción de potencia",
  REHABILITACION: "Rehabilitación",
  INSTALACION_ENLACE: "Instalación de enlace",
  PROVISORIO_GENERAL: "Provisorio general",
  PROVISORIO_OBRA: "Provisorio de obra",
  OTRO: "Otro",
};

export const ESTADO_LABEL: Record<UteTramiteComercialEstado, string> = {
  A_PEDIR: "A pedir",
  PEDIDO: "Pedido",
  OBSERVADO: "Observado",
  RESUELTO: "Resuelto",
  CANCELADO: "Cancelado",
};

/** Los estados que todavía piden seguimiento. */
export const ESTADOS_ABIERTOS: UteTramiteComercialEstado[] = [
  UteTramiteComercialEstado.A_PEDIR,
  UteTramiteComercialEstado.PEDIDO,
  UteTramiteComercialEstado.OBSERVADO,
];

// El campo "Trámite" del formulario de UTE (`ute-suministro/cells.ts` →
// OPCIONES.tramite) traducido al tipo. Si UTE agrega una opción y acá no
// está, el envío registra el trámite como OTRO con el texto tal cual.
const TIPO_DESDE_FORMULARIO: Record<string, UteTramiteComercialTipo> = {
  "Nuevo Servicio": UteTramiteComercialTipo.NUEVO_SERVICIO,
  Aumento: UteTramiteComercialTipo.AUMENTO,
  "Reducción": UteTramiteComercialTipo.REDUCCION,
  "Rehabilitación": UteTramiteComercialTipo.REHABILITACION,
  "Solicitud Instalación de Enlace": UteTramiteComercialTipo.INSTALACION_ENLACE,
  "Provisorio General *": UteTramiteComercialTipo.PROVISORIO_GENERAL,
  "Provisorio Obra": UteTramiteComercialTipo.PROVISORIO_OBRA,
};

/** Hoy en Uruguay, como se guardan las columnas de solo día. */
export function hoyComoDia(): Date {
  return new Date(`${hoyUruguay().iso}T00:00:00.000Z`);
}

function kw(v: string): string {
  const t = v.trim();
  if (!t) return "";
  return /kw/i.test(t) ? t : `${t} kW`;
}

/**
 * Deja registrado el trámite que se acaba de mandar con el formulario.
 *
 * Es de un proyecto o, si el cliente no tiene obra con Voltia, de un contacto
 * del CRM (uno de los dos, nunca ninguno).
 *
 * Si el proyecto (o el contacto) ya tiene uno abierto del mismo tipo y suministro, es un
 * reenvío (se corrigió un dato, UTE lo observó): se actualiza ese en vez de
 * abrir otro. La fecha de pedido no se pisa —el primer pedido es el que
 * cuenta para saber cuánto lleva—, salvo que estuviera "a pedir".
 */
export async function registrarTramiteEnviado(input: {
  projectId?: string | null;
  contactoId?: string | null;
  suministro?: number;
  tramiteFormulario: string;
  potenciaContratada: string;
  potenciaSolicitada: string;
  emailLogId: string;
  userId: string;
}) {
  const projectId = input.projectId || null;
  const contactoId = projectId ? null : input.contactoId || null;
  if (!projectId && !contactoId) {
    throw new Error("registrarTramiteEnviado: hace falta un proyecto o un contacto");
  }
  const tipo = TIPO_DESDE_FORMULARIO[input.tramiteFormulario.trim()] ?? UteTramiteComercialTipo.OTRO;
  const suministro = input.suministro ?? 1;
  const solicitada = kw(input.potenciaSolicitada);
  const contratada = kw(input.potenciaContratada);
  let detalle: string | null = null;
  if (tipo === UteTramiteComercialTipo.OTRO) {
    detalle = [input.tramiteFormulario.trim(), solicitada].filter(Boolean).join(" · ") || null;
  } else if (solicitada) {
    detalle = contratada && contratada !== solicitada ? `de ${contratada} a ${solicitada}` : `a ${solicitada}`;
  }

  const abierto = await prisma.uteTramiteComercial.findFirst({
    where: {
      ...(projectId ? { projectId } : { contactoId, projectId: null }),
      suministro,
      tipo,
      deletedAt: null,
      estado: { in: ESTADOS_ABIERTOS },
    },
    orderBy: { createdAt: "desc" },
  });

  if (abierto) {
    const tramite = await prisma.uteTramiteComercial.update({
      where: { id: abierto.id },
      data: {
        estado: UteTramiteComercialEstado.PEDIDO,
        solicitadoEl: abierto.solicitadoEl ?? hoyComoDia(),
        emailLogId: input.emailLogId,
        ...(detalle ? { detalle } : {}),
      },
    });
    return { tramite, nuevo: false };
  }

  const tramite = await prisma.uteTramiteComercial.create({
    data: {
      projectId,
      contactoId,
      suministro,
      tipo,
      detalle,
      estado: UteTramiteComercialEstado.PEDIDO,
      solicitadoEl: hoyComoDia(),
      emailLogId: input.emailLogId,
      createdById: input.userId,
    },
  });
  return { tramite, nuevo: true };
}
