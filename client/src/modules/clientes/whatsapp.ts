/**
 * Enlace para abrir WhatsApp con el mensaje ya escrito.
 *
 * Es el puente hasta que Voltia PM mande los mensajes por la API de WhatsApp: en
 * vez de copiar el texto, buscar el chat y pegarlo, se abre el chat del cliente
 * con el mensaje cargado. Funciona en el celular (abre la aplicación) y en la
 * computadora (abre WhatsApp Web o la aplicación de escritorio).
 */

/**
 * Normaliza un teléfono uruguayo al formato internacional sin "+" que pide
 * WhatsApp (598 + número sin el 0). Devuelve null si no parece un número válido.
 */
export function telefonoWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("598")) return d.length >= 11 ? d : null;
  // Celular local: 09X XXX XXX (9 dígitos) o 9X XXX XXX (8 dígitos).
  if (d.length === 9 && d.startsWith("09")) return `598${d.slice(1)}`;
  if (d.length === 8 && d.startsWith("9")) return `598${d}`;
  // Otro país, ya con su código: se usa tal cual.
  if (d.length >= 11) return d;
  return null;
}

export function enlaceWhatsApp(telefono: string, texto: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;
}
