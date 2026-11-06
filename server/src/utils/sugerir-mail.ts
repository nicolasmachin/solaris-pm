// Ayuda para el cliente que no se acuerda con qué mail está registrado: a partir
// de su nombre le muestra el comienzo de los mails que coinciden, para que se dé
// cuenta cuál es sin decírselo entero. El ingreso sigue siendo con el código que
// llega al mail, así que ver la pista no alcanza para entrar.

const MAX_SUGERENCIAS = 3;

function palabras(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Pide todas las palabras escritas. Con una sola palabra tiene que ser el nombre
 * completo (una empresa, por ejemplo): si no, "Gonzalez" listaría a varios clientes.
 */
export function coincideNombre(nombreUsuario: string, consulta: string): boolean {
  const buscadas = palabras(consulta);
  const delUsuario = palabras(nombreUsuario);
  if (buscadas.length === 0) return false;
  if (buscadas.length === 1) return delUsuario.length === 1 && delUsuario[0] === buscadas[0];
  return buscadas.every((p) => delUsuario.includes(p));
}

/** nicolas@voltia.com.uy → ni•••••@voltia.com.uy */
export function taparMail(email: string): string {
  const [local, dominio] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(local.length - 2, 1))}@${dominio}`;
}

export function sugerirMails(
  usuarios: Array<{ name: string; email: string | null }>,
  consulta: string,
): string[] {
  const mails = usuarios
    .filter((u) => u.email && coincideNombre(u.name, consulta))
    .map((u) => taparMail(u.email!));
  return [...new Set(mails)].slice(0, MAX_SUGERENCIAS);
}
