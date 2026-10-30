/**
 * Configuración del asistente de Instagram de Voltia PM (privados, lead magnets
 * y comentarios de @voltia_uy). Desde el 30-oct-2026 la lógica vive acá; el
 * servidor de indicadores (indicadores.voltia.com.uy) sigue siendo el dueño del
 * token de Meta y se lo pasa a Voltia PM por un endpoint interno. Ver
 * docs/manual/20-marketing.md.
 *
 * Los secretos nunca se loguean.
 */

/** apagado: no hace nada. sombra: arma las respuestas sin mandarlas. envio: contesta de verdad. */
export type ModoInstagram = "apagado" | "sombra" | "envio";

export function modoInstagram(): ModoInstagram {
  const m = (process.env.INSTAGRAM_MODO ?? "").trim().toLowerCase();
  return m === "envio" || m === "sombra" ? m : "apagado";
}

export type InstagramConectorConfig = {
  /** https://indicadores.voltia.com.uy, sin barra al final. */
  url: string;
  /** Secreto compartido con indicadores (Bearer en los dos sentidos). */
  secreto: string;
};

export function instagramConectorConfig(): InstagramConectorConfig {
  return {
    url: (process.env.INSTAGRAM_CONECTOR_URL ?? "").replace(/\/+$/, ""),
    secreto: process.env.INSTAGRAM_CONECTOR_SECRETO ?? "",
  };
}

/** Lo que se necesita para recibir los avisos de Meta (app "Voltia Indicadores"). */
export function webhookInstagramConfig() {
  return {
    appSecret: process.env.INSTAGRAM_APP_SECRET ?? "",
    verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN ?? "",
  };
}

export const IG = {
  graph: `https://graph.facebook.com/${process.env.INSTAGRAM_GRAPH_VERSION || "v21.0"}`,
  /** Página de Facebook Voltia, vinculada a @voltia_uy. */
  pagina: process.env.INSTAGRAM_PAGINA_ID || "100810082405123",
  /** Cuenta de Instagram @voltia_uy. */
  cuenta: process.env.INSTAGRAM_CUENTA_ID || "17841449732396009",
  usuario: "voltia_uy",
};

export function asistenteConfig() {
  return {
    modelo: process.env.INSTAGRAM_MODELO || "claude-haiku-5-5",
    /** Tope de gasto de Claude por mes (los dos lados: privados y comentarios). */
    topeUsd: Number(process.env.INSTAGRAM_TOPE_USD || 30),
    derivarA: process.env.INSTAGRAM_DERIVAR_A || "Martín García",
    derivarWhatsapp: process.env.INSTAGRAM_DERIVAR_WHATSAPP || "092 365 636",
    /** A quién le llega el mail de cada derivación o lead (con copia a avisos). */
    derivarMail: process.env.INSTAGRAM_DERIVAR_MAIL || "martin@voltia.com.uy",
    /** Avisos de gasto, comentarios para mirar y copia de las derivaciones. */
    avisosMail: process.env.INSTAGRAM_AVISOS_MAIL || "nicolas@voltia.com.uy",
    /** Si escribió ManyChat o una persona hace menos que esto, el asistente no contesta. */
    pausaOtroMin: Number(process.env.INSTAGRAM_PAUSA_OTRO_MIN || 30),
  };
}
