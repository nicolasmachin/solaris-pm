/**
 * Seguridad del webhook de Meta. Funciones puras, con tests en
 * whatsapp-cloud.test.ts.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la cabecera `X-Hub-Signature-256` que manda Meta: HMAC-SHA256 del
 * cuerpo **tal cual llegó** (no del JSON vuelto a armar, que puede cambiar
 * espacios o el orden y romper la firma), con la clave secreta de la aplicación.
 * Compara en tiempo constante. Sin clave configurada, rechaza todo.
 */
export function firmaValida(cuerpo: Buffer, cabecera: string | undefined, appSecret: string): boolean {
  if (!appSecret || !cabecera || !cabecera.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", appSecret).update(cuerpo).digest("hex");
  const recibida = cabecera.slice("sha256=".length);
  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(recibida, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * La verificación del webhook (el GET que hace Meta al guardarlo). Devuelve el
 * desafío a contestar, o null si el token no coincide.
 */
export function desafioSuscripcion(
  query: Record<string, unknown>,
  verifyToken: string,
): string | null {
  const modo = query["hub.mode"];
  const token = query["hub.verify_token"];
  const desafio = query["hub.challenge"];
  if (!verifyToken || modo !== "subscribe" || token !== verifyToken || typeof desafio !== "string") {
    return null;
  }
  return desafio;
}
