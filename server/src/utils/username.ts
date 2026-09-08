/**
 * Alias de ingreso (`username`): la forma corta de entrar a Voltia PM.
 *
 * Existe por dos motivos distintos que se resuelven igual:
 *
 *  - **Los Generadores muchas veces no tienen mail.** Sin alias no se les podía
 *    crear acceso al portal, y sin acceso no pueden abrir tickets ni responder
 *    encuestas. Eran 72 de 95 sin acceso.
 *  - **Los usuarios internos no quieren escribir el mail entero** para entrar.
 *
 * Reglas: minúsculas, sin tildes, sin espacios y sin `@` (para que nunca se
 * confunda con un mail). El login busca por mail O por alias, así que el
 * espacio de nombres es compartido: un alias no puede ser el mail de otro.
 */

export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** Saca tildes y deja solo lo que el alias admite. */
export function normalizarUsername(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function esUsernameValido(u: string): boolean {
  return USERNAME_REGEX.test(u);
}

/**
 * Alias tentativo a partir del nombre: "María Fernández Gómez" → "maria.fernandez".
 * Se queda con el primer nombre y el primer apellido; el resto es ruido para algo
 * que hay que dictarle a alguien por teléfono.
 */
export function usernameDesdeNombre(nombre: string): string {
  const partes = normalizarUsername(nombre).split(".").filter(Boolean);
  const base = partes.slice(0, 2).join(".");
  // Un nombre de una sola letra o puro símbolos no da un alias usable.
  return base.length >= 3 ? base : "";
}

/** Cédula uruguaya como alias: solo los dígitos, sin puntos ni guion. */
export function usernameDesdeCedula(ci: string): string {
  const digitos = ci.replace(/\D/g, "");
  return digitos.length >= 7 ? digitos : "";
}

/**
 * Agrega un sufijo numérico hasta encontrar uno libre. `estaLibre` decide: se le
 * pasa desde el service porque tiene que mirar mail Y alias a la vez.
 */
export async function primerUsernameLibre(
  base: string,
  estaLibre: (candidato: string) => Promise<boolean>,
): Promise<string> {
  if (!base) throw new Error("No se pudo derivar un alias del nombre");
  if (await estaLibre(base)) return base;
  for (let i = 2; i <= 99; i++) {
    const candidato = `${base}${i}`;
    if (await estaLibre(candidato)) return candidato;
  }
  throw new Error(`No hay alias libre para "${base}"`);
}
