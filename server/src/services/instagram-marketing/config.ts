/**
 * Conexión con el contestador de Instagram, que vive en el servidor del conector
 * de indicadores. Un solo secreto compartido sirve para las dos puntas: el
 * conector firma con él lo que le manda a Voltia PM (HMAC del cuerpo) y Voltia PM
 * lo manda como Bearer cuando le pide algo al conector. Nunca se loguea.
 *
 * Ver docs/manual/20-marketing.md.
 */

export type InstagramConectorConfig = {
  /** https://indicadores.voltia.com.uy, sin barra al final. */
  url: string;
  secreto: string;
};

export function instagramConectorConfig(): InstagramConectorConfig {
  return {
    url: (process.env.INSTAGRAM_CONECTOR_URL ?? "").replace(/\/+$/, ""),
    secreto: process.env.INSTAGRAM_CONECTOR_SECRETO ?? "",
  };
}
