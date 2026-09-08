// Mensaje único para compartir por WhatsApp/email cuando se le crea a un cliente
// el acceso al portal. Lo usan tanto Admin (Generadores del portal) como
// Experiencia Solar (Crear usuario de portal) para que el texto sea idéntico.

export function buildPortalWelcomeMessage(params: {
  name: string;
  /** El mail o el alias: lo que el cliente tiene que escribir para entrar. */
  identificador: string;
  password: string;
  /** true cuando entra con alias y no con mail, para no decirle "Email". */
  esAlias?: boolean;
}): string {
  const { name, identificador, password, esAlias } = params;
  const portalUrl = `${window.location.origin}/portal`;
  const primerNombre = name.trim().split(" ")[0] || name.trim();
  return `Hola ${primerNombre},

Te creamos un acceso al portal de Voltia para que veas el avance de tu instalación, la documentación y tus reportes de generación.

${esAlias ? "Usuario" : "Email"}: ${identificador}
Contraseña temporal: ${password}
Link: ${portalUrl}

Te pedirá cambiar la contraseña al ingresar.
Cualquier duda, escribinos.`;
}
