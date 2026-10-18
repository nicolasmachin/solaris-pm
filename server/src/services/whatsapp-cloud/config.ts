/**
 * Configuración de la Cloud API de WhatsApp (Meta). Todo sale de variables de
 * entorno; los secretos (token, clave de la aplicación, token de verificación)
 * viven solo en el servidor y nunca se loguean.
 *
 * Ver docs/manual/15-whatsapp.md y docs/DEPLOY.md §2.
 */

export type WhatsAppConfig = {
  token: string;
  appSecret: string;
  verifyToken: string;
  phoneNumberId: string;
  wabaId: string;
  graphVersion: string;
};

/** Versión de la Graph API por defecto: v26.0 es la vigente desde julio de 2026. */
const GRAPH_VERSION_DEFAULT = "v26.0";

export function whatsappConfig(): WhatsAppConfig {
  return {
    token: process.env.WHATSAPP_TOKEN ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    wabaId: process.env.WHATSAPP_WABA_ID ?? "",
    graphVersion: process.env.GRAPH_API_VERSION || GRAPH_VERSION_DEFAULT,
  };
}

/** Qué falta configurar para poder mandar. Vacío = listo. */
export function faltantesParaEnviar(c: WhatsAppConfig = whatsappConfig()): string[] {
  const faltan: string[] = [];
  if (!c.token) faltan.push("WHATSAPP_TOKEN");
  if (!c.phoneNumberId) faltan.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!c.wabaId) faltan.push("WHATSAPP_WABA_ID");
  return faltan;
}

export function graphUrl(path: string, c: WhatsAppConfig = whatsappConfig()): string {
  return `https://graph.facebook.com/${c.graphVersion}/${path.replace(/^\/+/, "")}`;
}
