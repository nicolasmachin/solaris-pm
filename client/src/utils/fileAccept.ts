// Qué formatos ofrece el selector de archivos cuando se piden fotos.
//
// `.heic`/`.heif` van listados aparte de los mimetypes porque varios
// navegadores de escritorio no reconocen el tipo y filtran por extensión: sin
// esto, un HEIC copiado de un iPhone a la computadora aparece en gris y no se
// puede ni elegir.
//
// El servidor convierte a JPEG cualquier HEIC que reciba, así que da igual si el
// celular manda el original o si iOS lo convierte solo antes de subirlo.

export const ACCEPT_FOTOS = "image/jpeg,image/png,image/webp,.heic,.heif";

export const ACCEPT_FOTOS_Y_PDF = `${ACCEPT_FOTOS},application/pdf`;
