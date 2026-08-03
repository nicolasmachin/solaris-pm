// Mensaje único para compartir por WhatsApp/email cuando se le crea a un cliente
// el acceso al portal. Lo usan tanto Admin (Generadores del portal) como
// Experiencia Solar (Crear usuario de portal) para que el texto sea idéntico.

export function buildPortalWelcomeMessage(params: { name: string; email: string; password: string }): string {
  const { name, email, password } = params;
  const portalUrl = `${window.location.origin}/portal`;
  const primerNombre = name.trim().split(" ")[0] || name.trim();
  return `Hola ${primerNombre},

Te creamos un acceso al portal de Voltia para que veas el avance de tu trámite UTE.

Email: ${email}
Contraseña temporal: ${password}
Link: ${portalUrl}

Te pedirá cambiar la contraseña al ingresar.
Cualquier duda, escribinos.`;
}
