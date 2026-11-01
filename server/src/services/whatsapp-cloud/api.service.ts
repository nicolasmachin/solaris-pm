/**
 * Llamadas a la Cloud API de WhatsApp: mandar mensajes y manejar plantillas.
 *
 * Todo mensaje que sale se guarda en `whatsapp_mensajes` con el id que devuelve
 * Meta, para cruzarlo con los estados que llegan después por el webhook.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest } from "../../utils/errors.js";
import { faltantesParaEnviar, graphUrl, whatsappConfig } from "./config.js";

const VENTANA_MS = 24 * 60 * 60 * 1000;

/** Error que devuelve Meta, con su mensaje, para mostrarlo tal cual en la pantalla. */
export class MetaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detalle: unknown,
  ) {
    super(message);
  }
}

/**
 * El número de Voltia por el que se manda y su cuenta de WhatsApp en Meta, con el
 * token para hablar con ella. Las plantillas son de la cuenta (WABA): un número
 * conectado aparte tiene las suyas. Ver `bandejas.service.ts`.
 */
export type Cuenta = { phoneNumberId: string; wabaId: string; token: string };

/** La cuenta de las variables de entorno (el número con el que se probó la conexión). */
export function cuentaDelServidor(): Cuenta {
  const c = whatsappConfig();
  const faltan = faltantesParaEnviar(c);
  if (faltan.length > 0) {
    throw badRequest("WHATSAPP_NO_CONFIGURADO", `Falta configurar en el servidor: ${faltan.join(", ")}.`);
  }
  return { phoneNumberId: c.phoneNumberId, wabaId: c.wabaId, token: c.token };
}

async function llamarMeta<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }, cuenta: Cuenta): Promise<T> {
  const res = await fetch(graphUrl(path), {
    method: init.method,
    headers: {
      Authorization: `Bearer ${cuenta.token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; error_user_msg?: string } };
  if (!res.ok) {
    const msg = data.error?.error_user_msg ?? data.error?.message ?? `Meta respondió ${res.status}`;
    throw new MetaApiError(msg, res.status, data.error ?? data);
  }
  return data as T;
}

/** Normaliza un teléfono al formato que pide WhatsApp: solo dígitos, con código de país. */
export function normalizarTelefono(telefono: string): string {
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("09")) d = `598${d.slice(1)}`;
  else if (d.length === 8 && d.startsWith("9")) d = `598${d}`;
  return d;
}

/**
 * ¿Está abierta la ventana de 24 h? Se abre cuando el cliente nos escribe, y es
 * por número: escribirle a un asesor no abre la del número general.
 */
export async function ventanaAbierta(telefono: string, phoneNumberId: string, ahora: Date = new Date()): Promise<boolean> {
  const ultimo = await prisma.whatsAppMensaje.findFirst({
    where: { telefono, phoneNumberId, direccion: "ENTRANTE" },
    orderBy: { ocurridoEn: "desc" },
    select: { ocurridoEn: true },
  });
  return !!ultimo && ahora.getTime() - ultimo.ocurridoEn.getTime() < VENTANA_MS;
}

type RespuestaEnvio = { messages?: Array<{ id: string }>; contacts?: Array<{ wa_id: string }> };

async function registrarSaliente(params: {
  respuesta: RespuestaEnvio;
  telefono: string;
  tipo: string;
  texto: string | null;
  plantilla: string | null;
  userId: string | null;
  phoneNumberId: string;
}) {
  const waMessageId = params.respuesta.messages?.[0]?.id;
  if (!waMessageId) throw new MetaApiError("Meta no devolvió el id del mensaje", 502, params.respuesta);
  const mensaje = await prisma.whatsAppMensaje.create({
    data: {
      waMessageId,
      direccion: "SALIENTE",
      telefono: params.respuesta.contacts?.[0]?.wa_id ?? params.telefono,
      phoneNumberId: params.phoneNumberId,
      tipo: params.tipo,
      texto: params.texto,
      plantilla: params.plantilla,
      estado: "accepted",
      ocurridoEn: new Date(),
      enviadoPorId: params.userId,
      payload: params.respuesta as unknown as Prisma.InputJsonValue,
    },
  });
  // El webhook a veces avisa "enviado" antes de que se guarde esta fila: si ya
  // hay estados, se le aplica el más reciente.
  const ultimo = await prisma.whatsAppEstado.findFirst({
    where: { waMessageId },
    orderBy: { ocurridoEn: "desc" },
  });
  if (ultimo) {
    return prisma.whatsAppMensaje.update({
      where: { id: mensaje.id },
      data: { estado: ultimo.estado, estadoEn: ultimo.ocurridoEn },
    });
  }
  return mensaje;
}

/** Manda una plantilla aprobada. Es lo único que se puede mandar fuera de la ventana de 24 h. */
export async function enviarPlantilla(params: {
  telefono: string;
  nombre: string;
  idioma: string;
  variables?: string[];
  userId: string | null;
  /** El texto tal como le llega al cliente, si se conoce (los avisos automáticos lo arman). */
  texto?: string;
  /** Por qué número sale. Sin cuenta, el de las variables de entorno. */
  cuenta?: Cuenta;
}) {
  const telefono = normalizarTelefono(params.telefono);
  const cuenta = params.cuenta ?? cuentaDelServidor();
  const variables = (params.variables ?? []).filter((v) => v.trim() !== "");
  const respuesta = await llamarMeta<RespuestaEnvio>(`${cuenta.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      to: telefono,
      type: "template",
      template: {
        name: params.nombre,
        language: { code: params.idioma },
        ...(variables.length > 0
          ? { components: [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: v })) }] }
          : {}),
      },
    },
  }, cuenta);
  return registrarSaliente({
    respuesta,
    telefono,
    tipo: "template",
    texto: params.texto ?? (variables.length > 0 ? variables.join(" · ") : null),
    plantilla: params.nombre,
    userId: params.userId,
    phoneNumberId: cuenta.phoneNumberId,
  });
}

/** Manda texto libre. Solo dentro de la ventana de 24 h: fuera de ella Meta lo rechaza. */
export async function enviarTexto(params: { telefono: string; texto: string; userId: string; cuenta?: Cuenta }) {
  const telefono = normalizarTelefono(params.telefono);
  const cuenta = params.cuenta ?? cuentaDelServidor();
  if (!(await ventanaAbierta(telefono, cuenta.phoneNumberId))) {
    throw badRequest(
      "WHATSAPP_VENTANA_CERRADA",
      "Este número no escribió en las últimas 24 horas: solo se le puede mandar una plantilla aprobada.",
    );
  }
  const respuesta = await llamarMeta<RespuestaEnvio>(`${cuenta.phoneNumberId}/messages`, {
    method: "POST",
    body: { messaging_product: "whatsapp", to: telefono, type: "text", text: { body: params.texto } },
  }, cuenta);
  return registrarSaliente({
    respuesta,
    telefono,
    tipo: "text",
    texto: params.texto,
    plantilla: null,
    userId: params.userId,
    phoneNumberId: cuenta.phoneNumberId,
  });
}

export type PlantillaMeta = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  rejected_reason?: string;
  components?: Array<{ type: string; text?: string; format?: string }>;
};

/** Las plantillas de la cuenta de WhatsApp, con su estado de aprobación. Se consultan en vivo. */
export async function listarPlantillas(cuenta: Cuenta = cuentaDelServidor()): Promise<PlantillaMeta[]> {
  const data = await llamarMeta<{ data?: PlantillaMeta[] }>(
    `${cuenta.wabaId}/message_templates?fields=id,name,status,category,language,rejected_reason,components&limit=100`,
    { method: "GET" },
    cuenta,
  );
  return data.data ?? [];
}

/**
 * Crea una plantilla y la manda a revisión de Meta. El cuerpo lleva los huecos
 * como {{1}}, {{2}}…, y Meta exige un ejemplo para cada uno.
 */
export async function crearPlantilla(
  params: {
    nombre: string;
    categoria: "UTILITY" | "MARKETING";
    idioma: string;
    cuerpo: string;
    ejemplos: string[];
  },
  cuenta: Cuenta = cuentaDelServidor(),
) {
  const huecos = [...params.cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const cantidad = huecos.length > 0 ? Math.max(...huecos) : 0;
  if (cantidad !== params.ejemplos.length) {
    throw badRequest(
      "PLANTILLA_EJEMPLOS",
      `El texto tiene ${cantidad} hueco(s) y se cargaron ${params.ejemplos.length} ejemplo(s): Meta pide uno por hueco.`,
    );
  }
  return llamarMeta<{ id: string; status: string; category: string }>(`${cuenta.wabaId}/message_templates`, {
    method: "POST",
    body: {
      name: params.nombre,
      language: params.idioma,
      category: params.categoria,
      components: [
        {
          type: "BODY",
          text: params.cuerpo,
          ...(cantidad > 0 ? { example: { body_text: [params.ejemplos] } } : {}),
        },
      ],
    },
  }, cuenta);
}
