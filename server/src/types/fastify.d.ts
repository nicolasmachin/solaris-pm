import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
      // name del rol (ej: "ADMIN", "OPERACIONES"). Desde el refactor de roles
      // dinámicos es un string libre sourced de la tabla roles.
      role: string;
    };
    /**
     * Presente sólo cuando un usuario interno está mirando el portal como lo ve
     * un cliente. En ese caso `user` YA ES el usuario del cliente (para que
     * todas las consultas del portal funcionen sin cambios) y esto guarda quién
     * está mirando en realidad, para auditar y para bloquear escrituras.
     */
    portalPreview?: {
      projectId: string;
      internoId: string;
      internoNombre: string;
      internoRole: string;
    };
  }
}
