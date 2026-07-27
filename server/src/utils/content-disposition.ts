/**
 * Construye un header `Content-Disposition` seguro para cualquier filename,
 * incluyendo nombres con caracteres fuera de Latin-1 (tildes en forma
 * descompuesta NFD de macOS, emojis, guiones largos, comillas curvas, CJK…).
 *
 * Node valida el valor de los headers HTTP y **solo acepta bytes 0x00–0xFF**.
 * Un filename con code points > 255 (ej. `a` + U+0301 combinante = "á" de
 * macOS) lanza `ERR_INVALID_CHAR` y tumba la respuesta con un 500.
 *
 * Solución estándar (RFC 6266 / RFC 5987): emitir dos parámetros
 *   - `filename="<fallback-ascii>"`  → clientes viejos
 *   - `filename*=UTF-8''<percent-encoded>` → clientes modernos (todos hoy)
 *
 * @param disposition `"inline"` (preview) o `"attachment"` (descarga forzada).
 * @param filename    Nombre original del archivo, tal cual lo subió el usuario.
 */
export function contentDisposition(
  disposition: "inline" | "attachment",
  filename: string,
): string {
  // Fallback ASCII: reemplaza cualquier char no imprimible/no-ASCII y las
  // comillas por "_", para que el parámetro clásico nunca rompa.
  const asciiFallback = filename.replace(/["\\]/g, "_").replace(/[^\x20-\x7e]/g, "_");

  // RFC 5987: percent-encoding UTF-8 del nombre completo.
  const encoded = encodeURIComponent(filename)
    // encodeURIComponent no escapa estos, pero RFC 5987 los reserva.
    .replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
